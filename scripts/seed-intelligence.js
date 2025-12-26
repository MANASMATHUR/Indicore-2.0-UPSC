import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config();
}

import FactUnit from '../models/FactUnit.js';

const SEED_FACTS = [
    {
        statement: "Article 14 of the Indian Constitution ensures equality before the law and equal protection of the laws within the territory of India.",
        subject: "polity",
        topic: "Fundamental Rights",
        gsPaper: "GS2",
        maturity: 100,
        verified: true,
        sourceType: "Official Document",
        source: "Constitution of India"
    },
    {
        statement: "The Basic Structure Doctrine was established by the Supreme Court in the Kesavananda Bharati case (1973), stating that Parliament cannot amend certain fundamental features of the Constitution.",
        subject: "polity",
        topic: "Constitutional Framework",
        gsPaper: "GS2",
        maturity: 100,
        verified: true,
        sourceType: "Official Document",
        source: "SC Landmark Judgments"
    },
    {
        statement: "The Finance Commission is a constitutional body established under Article 280 to recommend the distribution of tax revenues between the Union and the States.",
        subject: "polity",
        topic: "Constitutional Bodies",
        gsPaper: "GS2",
        maturity: 95,
        verified: true,
        sourceType: "Official Document",
        source: "Constitution of India"
    },
    {
        statement: "The Goods and Services Tax (GST) was introduced via the 101st Constitutional Amendment Act, aiming to create a unified national market by replacing multiple indirect taxes.",
        subject: "economics",
        topic: "Indian Economy",
        gsPaper: "GS3",
        maturity: 90,
        verified: true,
        sourceType: "Official Document",
        source: "Ministry of Finance"
    },
    {
        statement: "The NITI Aayog (National Institution for Transforming India) replaced the Planning Commission in 2015 to foster cooperative federalism and provide strategic policy advice.",
        subject: "governance",
        topic: "Government Institutions",
        gsPaper: "GS2",
        maturity: 95,
        verified: true,
        sourceType: "Official Document",
        source: "Government Notification"
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing (optional, but good for clean seeding in dev)
        // await FactUnit.deleteMany({ sourceType: 'Manual' });

        for (const fact of SEED_FACTS) {
            await FactUnit.findOneAndUpdate(
                { statement: fact.statement },
                fact,
                { upsert: true, new: true }
            );
        }

        console.log(`✅ Successfully seeded ${SEED_FACTS.length} Fact-Units.`);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
