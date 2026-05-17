/**
 * seedHealthData.js
 * =================
 * Generates the last 30 days of realistic Apple Health-style records and
 * inserts them into the healthrecords collection.
 *
 * Generates:
 *   - HKQuantityTypeIdentifierStepCount        (~30-60 records/day, summing to a daily total)
 *   - HKQuantityTypeIdentifierActiveEnergyBurned (~20-40 records/day)
 *   - HKCategoryTypeIdentifierSleepAnalysis    (1 record/night)
 *
 * Each user gets their own "personality" (high/medium/low baseline) so the
 * data isn't all the same and the ML model can learn variation.
 *
 * Usage (from services/api-server/):
 *   node scripts/seedHealthData.js <userId>
 *   node scripts/seedHealthData.js 6a05fc953f36164e0263c4c7
 *
 * Optional flags:
 *   --days=30     (default 30)
 *   --clear       (delete existing records for this user first)
 *
 * Example:
 *   node scripts/seedHealthData.js 6a05fc953f36164e0263c4c7 --days=45 --clear
 */


import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import HealthRecord from '../models/HealthRecord.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// ─── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const userId = args.find(a => !a.startsWith('--'));
const daysArg = args.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;
const clearFirst = args.includes('--clear');

if (!userId) {
    console.error('❌ Usage: node scripts/seedHealthData.js <userId> [--days=30] [--clear]');
    process.exit(1);
}

if (!mongoose.Types.ObjectId.isValid(userId)) {
    console.error('❌ Invalid userId — must be a 24-char ObjectId');
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Pick a "personality" for this user so their data has a consistent profile
const personalities = [
    { name: 'Active', stepsBase: 9500, stepsVar: 2500, sleepBase: 7.5, sleepVar: 0.6, energyMult: 1.15 },
    { name: 'Moderate', stepsBase: 7000, stepsVar: 2000, sleepBase: 7.2, sleepVar: 0.8, energyMult: 1.0 },
    { name: 'Sedentary', stepsBase: 4500, stepsVar: 1800, sleepBase: 6.5, sleepVar: 1.0, energyMult: 0.85 },
    { name: 'Inconsistent', stepsBase: 6500, stepsVar: 3500, sleepBase: 6.8, sleepVar: 1.4, energyMult: 0.95 },
];
const personality = personalities[Math.floor(Math.random() * personalities.length)];
console.log(`🎲 Assigned personality: ${personality.name}`);

/**
 * Generate one day of step records.
 * Returns an array of records spread across waking hours, summing to ~daily target.
 */
function generateDaySteps(date, dailyTarget, userObjectId) {
    const records = [];
    let stepsRemaining = dailyTarget;

    // 30-60 records spread between 7am and 10pm
    const numRecords = randInt(30, 60);

    for (let i = 0; i < numRecords && stepsRemaining > 0; i++) {
        // Pick a random minute between 7am and 10pm
        const hour = randInt(7, 21);
        const minute = randInt(0, 59);
        const second = randInt(0, 59);
        const duration = randInt(3, 15); // 3-15 min activity blocks

        const startDate = new Date(date);
        startDate.setHours(hour, minute, second, 0);
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

        // Steps for this block — last block takes whatever's left
        let blockSteps;
        if (i === numRecords - 1) {
            blockSteps = Math.max(50, stepsRemaining);
        } else {
            const avgPerBlock = stepsRemaining / (numRecords - i);
            blockSteps = Math.max(50, Math.round(rand(avgPerBlock * 0.3, avgPerBlock * 1.7)));
            blockSteps = Math.min(blockSteps, stepsRemaining);
        }

        records.push({
            userId: userObjectId,
            type: 'HKQuantityTypeIdentifierStepCount',
            value: blockSteps,
            unit: 'count',
            startDate,
            endDate,
        });
        stepsRemaining -= blockSteps;
    }
    return records;
}

/**
 * Generate one day of active energy records.
 * Roughly correlated with steps (more steps → more energy).
 */
function generateDayEnergy(date, dailyStepsTarget, mult, userObjectId) {
    const records = [];
    // Base energy from steps: ~0.04 kcal per step + BMR active contribution
    // Plus random non-step activity
    let dailyEnergyTarget = (dailyStepsTarget * 0.045 + rand(80, 200)) * mult;

    const numRecords = randInt(20, 40);
    let energyRemaining = dailyEnergyTarget;


    for (let i = 0; i < numRecords && energyRemaining > 0; i++) {
        const hour = randInt(7, 22);
        const minute = randInt(0, 59);
        const second = randInt(0, 59);
        const duration = randInt(5, 30);

        const startDate = new Date(date);
        startDate.setHours(hour, minute, second, 0);
        const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

        let blockEnergy;
        if (i === numRecords - 1) {
            blockEnergy = Math.max(5, energyRemaining);
        } else {
            const avgPerBlock = energyRemaining / (numRecords - i);
            blockEnergy = Math.max(5, rand(avgPerBlock * 0.3, avgPerBlock * 1.7));
            blockEnergy = Math.min(blockEnergy, energyRemaining);
        }

        records.push({
            userId: userObjectId,
            type: 'HKQuantityTypeIdentifierActiveEnergyBurned',
            value: Math.round(blockEnergy * 10) / 10, // 1 decimal place
            unit: 'kcal',
            startDate,
            endDate,
        });
        energyRemaining -= blockEnergy;
    }
    return records;
}

/**
 * Generate one night's sleep record.
 * Sleep starts the previous evening (10pm-12:30am) and ends in the morning.
 * The record is filed under the WAKE-UP date — that's how Apple Health does it.
 */
function generateSleep(wakeDate, durationHours, userObjectId) {
    // Wake time: 5:30am - 9:00am
    const wakeHour = randInt(5, 8);
    const wakeMinute = randInt(0, 59);
    const wakeTime = new Date(wakeDate);
    wakeTime.setHours(wakeHour, wakeMinute, 0, 0);

    // Sleep start = wake time - durationHours
    const sleepStart = new Date(wakeTime.getTime() - durationHours * 60 * 60 * 1000);

    return {
        userId: userObjectId,
        type: 'HKCategoryTypeIdentifierSleepAnalysis',
        value: Math.round(durationHours * 100) / 100,   // duration in hours
        unit: 'hr',
        startDate: sleepStart,
        endDate: wakeTime,
    };
}

// ─── Main ────────────────────────────────────────────────────
async function seed() {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('❌ MONGO_URI env var not set. Check your .env');
        process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');

    const userObjectId = new mongoose.Types.ObjectId(userId);

    if (clearFirst) {
        const result = await HealthRecord.deleteMany({ userId: userObjectId });
        console.log(`🗑️  Cleared ${result.deletedCount} existing records for this user`);
    }

    const allRecords = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log(`📅 Generating ${days} days of data ending ${today.toISOString().split('T')[0]}...`);

    for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
        const date = new Date(today);
        date.setDate(date.getDate() - dayOffset);

        // Daily variation: weekends slightly different, plus occasional "off days"
        const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isOffDay = Math.random() < 0.10; // 10% chance of a low/bad day

        // Steps
        let dailySteps = personality.stepsBase + rand(-personality.stepsVar, personality.stepsVar);
        if (isWeekend) dailySteps *= rand(0.85, 1.15);
        if (isOffDay) dailySteps *= rand(0.3, 0.6);
        dailySteps = Math.max(800, Math.round(dailySteps));

        // Sleep (hours)
        let sleepHours = personality.sleepBase + rand(-personality.sleepVar, personality.sleepVar);
        if (isWeekend) sleepHours += rand(0, 0.8);  // slight weekend lie-in
        if (isOffDay) sleepHours -= rand(0.5, 2.0);
        sleepHours = Math.max(3.5, Math.min(11, sleepHours));

        // Build records
        const stepRecs = generateDaySteps(date, dailySteps, userObjectId);
        const energyRecs = generateDayEnergy(date, dailySteps, personality.energyMult, userObjectId);
        const sleepRec = generateSleep(date, sleepHours, userObjectId);

        allRecords.push(...stepRecs, ...energyRecs, sleepRec);

        process.stdout.write(`\r  Day ${days - dayOffset}/${days}  ` +
            `steps=${dailySteps.toString().padStart(5)}  ` +
            `sleep=${sleepHours.toFixed(1)}h  ` +
            `${isWeekend ? '(weekend)' : '         '} ${isOffDay ? '(off day)' : ''}    `);
    }
    console.log('\n');

    console.log(`📦 Inserting ${allRecords.length.toLocaleString()} records...`);

    try {
        // Use insertMany with ordered:false so dupes don't kill the whole batch
        const result = await HealthRecord.insertMany(allRecords, { ordered: false });
        console.log(`✓ Inserted ${result.length.toLocaleString()} records`);
    } catch (err) {
        // The unique index (userId, type, startDate) may reject duplicates.
        // ordered:false means others still inserted — read .insertedDocs from err.
        if (err.insertedDocs) {
            console.log(`✓ Inserted ${err.insertedDocs.length.toLocaleString()} (some duplicates skipped)`);
        } else {
            throw err;
        }
    }

    // Summary
    const counts = await HealthRecord.aggregate([
        { $match: { userId: userObjectId } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
    ]);
    console.log('\n📊 Final record counts for this user:');
    counts.forEach(c => console.log(`   ${c._id.padEnd(40)} ${c.count.toString().padStart(6)}`));

    await mongoose.disconnect();
    console.log('\n✓ Done. Disconnected from MongoDB.');
    process.exit(0);
}

seed().catch(err => {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
});
