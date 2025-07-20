const {default: mongoose} = require('mongoose');

const dbConnect = () => {
    mongoose.connect(process.env.MONGODB_URI, {dbName: 'solar-express'})
    .then(() => {
        console.log("Seccessfully connected to MongoDB");
    })
    .catch((error) => {
        console.log("Error connecting to MongoDB");
    })
}

module.exports = dbConnect;