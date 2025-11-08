import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Your MongoDB connection string
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb+srv://Manas:Manas%402005@fastapi-cwh.t09sscb.mongodb.net/?retryWrites=true&w=majority&appName=FastAPI-CWH';

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
      console.log('');
    });
    
    // Get all chats
    const chats = await chatsCollection.find({}).toArray();
    console.log(`\n💬 Found ${chats.length} chats\n`);
    
    // Display chat data
    chats.forEach((chat, index) => {
      console.log(`💬 Chat ${index + 1}:`);
      console.log(`   Name: ${chat.name}`);
      console.log(`   User ID: ${chat.userId}`);
      console.log(`   Messages: ${chat.messages?.length || 0}`);
      console.log(`   Created: ${chat.createdAt}`);
      console.log(`   Updated: ${chat.updatedAt}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

viewUserData();

