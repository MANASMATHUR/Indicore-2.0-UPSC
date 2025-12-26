import connectToDatabase from '@/lib/mongodb';
import FactUnit from '@/models/FactUnit';
import PYQ from '@/models/PYQ';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        await connectToDatabase();

        // Fetch counts
        const totalFacts = await FactUnit.countDocuments();
        const verifiedFacts = await FactUnit.countDocuments({ verified: true });

        const pyqStats = await PYQ.aggregate([
            { $group: { _id: "$exam", count: { $sum: 1 } } }
        ]);

        // Calculate maturity distribution
        const maturityStats = await FactUnit.aggregate([
            {
                $group: {
                    _id: {
                        $concat: [
                            { $toString: { $multiply: [{ $floor: { $divide: ["$maturity", 20] } }, 20] } },
                            "-",
                            { $toString: { $add: [{ $multiply: [{ $floor: { $divide: ["$maturity", 20] } }, 20] }, 19] } }
                        ]
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get latest cleaned items
        const latestItems = await FactUnit.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return res.status(200).json({
            totalFacts,
            verifiedFacts,
            pyqStats,
            maturityStats,
            latestItems,
            systemHealth: "Optimal",
            lastAudit: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Intelligence API] Error:', error);
        return res.status(500).json({ error: 'Failed to fetch intelligence stats' });
    }
}
