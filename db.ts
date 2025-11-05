import mongoose from 'mongoose';

const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/tortuga';
mongoose.set('strictQuery', true);

mongoose
  .connect(uri)
  .then(() => console.log('Mongo connected'))
  .catch((e) => {
    console.error('Mongo connection error:', e);
    process.exit(1);
  });
