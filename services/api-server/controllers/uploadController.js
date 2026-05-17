import axios from 'axios';
import path from 'path';
import fs from 'fs'; // Added for file system operations
import AdmZip from 'adm-zip'; // Added for ZIP handling
import HealthRecord from '../models/HealthRecord.js';


// ENFORCEMENT: Only use userId from authenticated token
export const handleUpload = async (req, res) => {
    const { userId } = req.body;

    if (!req.user || req.user._id.toString() !== userId) {
        return res.status(403).json({
            error: 'Security Breach: Authenticated user does not match target userId'
        });
    }

    // 2. Check if file was uploaded
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    let absolutePath = path.resolve(req.file.path);
    let tempUnzipPath = null;

    try {
        // --- ZIP HANDLING FEATURE START ---
        const fileExt = path.extname(req.file.originalname).toLowerCase();

        if (fileExt === '.zip') {
            const zip = new AdmZip(absolutePath);
            const zipEntries = zip.getEntries();

            // Look for the export.xml file anywhere in the ZIP
            const xmlEntry = zipEntries.find(entry => entry.entryName.endsWith('export.xml'));

            if (!xmlEntry) {
                throw new Error('Invalid ZIP: Could not find export.xml inside the archive.');
            }

            // Create a temporary directory to extract the XML
            const extractFolder = path.join(path.dirname(absolutePath), `extracted-${Date.now()}`);
            if (!fs.existsSync(extractFolder)) fs.mkdirSync(extractFolder);

            // Extract only the export.xml file
            zip.extractEntryTo(xmlEntry, extractFolder, false, true);

            // Update the path to point to the extracted XML for the Python service
            absolutePath = path.join(extractFolder, path.basename(xmlEntry.entryName));
            tempUnzipPath = extractFolder; // Store to delete later
        }
        // --- ZIP HANDLING FEATURE END ---

        // 3. Call the Flask service
        const pythonResponse = await axios.post('http://localhost:8000/process-xml', {
            filePath: absolutePath
        });

        // DEBUG: See exactly what Python is sending back
        console.log('Python Service Response:', pythonResponse.data);

        let cleanedData = pythonResponse.data;

        // 4. Validate Python Response Structure
        if (cleanedData.data && Array.isArray(cleanedData.data)) {
            cleanedData = cleanedData.data;
        }

        if (!Array.isArray(cleanedData)) {
            throw new Error(`Python service returned an object instead of an array: ${JSON.stringify(cleanedData)}`);
        }


        // 5. Map data using the SECURE userId from the token
        const recordsToSave = cleanedData.map(record => {
            return {
                userId: userId,
                type: record.type,
                value: parseFloat(record.value),
                unit: record.unit,
                startDate: new Date(record.startDate),
                endDate: new Date(record.endDate)
            };
        });

        // 6. Bulk Storage with Duplicate Prevention
        if (recordsToSave.length > 0) {
            try {
                await HealthRecord.insertMany(recordsToSave, { ordered: false });
            } catch (err) {
                if (err.code !== 11000 && !err.writeErrors) {
                    throw err;
                }
                console.log(`Skipped ${err.writeErrors?.length || 'some'} duplicate records.`);
            }
        }

        // Clean up extracted folder if it exists
        if (tempUnzipPath) {
            fs.rmSync(tempUnzipPath, { recursive: true, force: true });
        }

        // 7. Final Response
        return res.status(200).json({
            message: 'Data successfully processed. New records added, duplicates skipped.',
            userId: userId,
            processedCount: recordsToSave.length
        });

    } catch (error) {
        // Cleanup on error
        if (tempUnzipPath) fs.rmSync(tempUnzipPath, { recursive: true, force: true });

        console.error('Hand-off Error:', error.message);
        return res.status(500).json({
            error: 'Failed to process and store health data',
            details: error.message
        });
    }
};