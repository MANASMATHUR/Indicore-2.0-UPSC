import connectToDatabase from '@/lib/mongodb';
import Visitor from '@/models/Visitor';
import User from '@/models/User';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { visitorId, userEmail } = req.body;

    if (!visitorId || !userEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    await connectToDatabase();

    // Find user by email
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find visitor and mark as converted
    const visitor = await Visitor.findOne({ visitorId });
    if (visitor && !visitor.converted) {
      visitor.converted = true;
      visitor.userId = user._id;
      visitor.userEmail = userEmail;
      visitor.convertedAt = new Date();
      await visitor.save();
    }

    // Also mark any other visits from this visitor as converted
    await Visitor.updateMany(
      { visitorId, converted: false },
      {
        $set: {
          converted: true,
          userId: user._id,
          userEmail: userEmail,
          convertedAt: new Date()
        }
      }
    );

    return res.status(200).json({ 
      success: true,
      converted: true 
    });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    return res.status(200).json({ 
      success: false, 
      error: error.message 
    });
  }
}

