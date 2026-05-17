from flask import Flask, request, jsonify
import os
import numpy as np
from preprocessing.cleaner import parse_apple_health_xml

app = Flask(__name__)

@app.route('/')
def test():
    return ("TESTING ML-ENGINE")

@app.route('/process-xml', methods=['POST'])
def process_xml():
    data = request.get_json()
    file_path = data.get('filePath')

    if not file_path or not os.path.exists(file_path):
        return jsonify({"error": f"File not found at {file_path}"}), 400

    try:
        # Get the list of records from your cleaner.py
        cleaned_records = parse_apple_health_xml(file_path)
        
        # Format the data for JSON (convert Timestamps to strings)
        for record in cleaned_records:
            if hasattr(record['startDate'], 'isoformat'):
                record['startDate'] = record['startDate'].isoformat()
            if hasattr(record['endDate'], 'isoformat'):
                record['endDate'] = record['endDate'].isoformat()
            
            # Handle Python NaN/Inf values which crash JSON
            if isinstance(record['value'], float) and (np.isnan(record['value']) or np.isinf(record['value'])):
                record['value'] = 0

        # Return the RAW LIST so .map() works in Node.js
        return jsonify(cleaned_records), 200

    except Exception as e:
        # If this happens, Node.js will catch the 500 error
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Capture dynamic port assigned by Render, falling back to 8000 for local safety
    port = int(os.environ.get("PORT", 8000))
    
    # CRITICAL: host="0.0.0.0" allows the API server container to route network calls here
    app.run(host="0.0.0.0", port=port, debug=False)
