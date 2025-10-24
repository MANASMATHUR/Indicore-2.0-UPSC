

const { MongoClient } = require('mongodb');

// Your MongoDB connection string
const MONGODB_URI = 'mongodb+srv://Manas:Manas%402005@fastapi-cwh.t09sscb.mongodb.net/?retryWrites=true&w=majority&appName=FastAPI-CWH';

async function viewUserData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');
    
    const db = client.db('test'); // or your database name
    const usersCollection = db.collection('users');
    const chatsCollection = db.collection('chats');
    
    // Get all users
    const users = await usersCollection.find({}).toArray();
    console.log(`\n📊 Found ${users.length} users\n`);
    
    // Display user data
    users.forEach((user, index) => {
      console.log(`👤 User ${index + 1}:`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Google ID: ${user.googleId}`);
      console.log(`   Picture: ${user.picture}`);
      console.log(`   Last Login: ${user.lastLogin}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log(`   Preferences:`, user.preferences);
      console.log(`   Memory Stats:`, user.memory);
      console.log('   ' + '─'.repeat(50));
    });
    
    // Get chat statistics
    const totalChats = await chatsCollection.countDocuments({ isActive: true });
    const totalMessages = await chatsCollection.aggregate([
      { $match: { isActive: true } },
      { $project: { messageCount: { $size: '$messages' } } },
      { $group: { _id: null, total: { $sum: '$messageCount' } } }
    ]).toArray();
    
    console.log(`\n📈 Statistics:`);
    console.log(`   Total Users: ${users.length}`);
    console.log(`   Total Chats: ${totalChats}`);
    console.log(`   Total Messages: ${totalMessages[0]?.total || 0}`);
    
    // Get recent users (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentUsers = await usersCollection.countDocuments({
      lastLogin: { $gte: sevenDaysAgo }
    });
    
    console.log(`   Active Users (7 days): ${recentUsers}`);
    
    // Export to CSV format
    console.log(`\n📄 CSV Export Format:`);
    console.log('Name,Email,Google ID,Last Login,Created At,Total Questions,Session Questions');
    users.forEach(user => {
      console.log(`"${user.name}","${user.email}","${user.googleId}","${user.lastLogin}","${user.createdAt}","${user.memory?.totalQuestions || 0}","${user.memory?.sessionQuestions || 0}"`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
viewUserData();
