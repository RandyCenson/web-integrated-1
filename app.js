const http = require('http');
const fs = require('fs');
const bcrypt = require('bcrypt');
const express = require('express');
const path = require('path');
const app = express();
const port = 3000;



app.use(express.urlencoded({ extended: true }));

//dotnev
require('dotenv').config();
const admin = require('firebase-admin');

const serviceAccount = {
    type: process.env.FIREBASE_TYPE,
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), // Replace escaped newline characters
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI,
    token_uri: process.env.FIREBASE_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN,
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),  
});


// var admin = require("firebase-admin");


// var serviceAccount = require("./web-int-1-firebase-adminsdk-xiyt8-73777d32cf.json");


// admin.initializeApp({

//     credential: admin.credential.cert(serviceAccount)

// });


const e = require('express');
const { console } = require('inspector');


app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

const db = admin.firestore();
let currUserName = '';

app.get('/', (req, res) => {
    res.render('index');
})

app.get('/signUp', (req, res) => {
    res.render('SignUp');
})

app.get('/login', (req, res) => {
    res.render('login');
})


app.post('/submitToAddUser',async (req, res) => {
    const emailInput = req.body.email;
    const passwordInput = req.body.password;
    const nameInput = req.body.name;
    
    const saltRounds = 10;
    try {
        const docRef = await db.collection('users');

        const hashedPassword = await bcrypt.hash(passwordInput, saltRounds);
        docRef.add({
            email: emailInput,
            name: nameInput,
            password: hashedPassword
        });
        const productData ={
            productName: 'default',
            quantity: 0,
        };
        const docRef2 = await db.collection('users_inventory').doc(`${nameInput}`).collection('product').add(productData);
        // const docRef2 = await db.collection('users_inventory').doc(`${nameInput}`).collection('product');
        //working
        // await docRef2.set({
        //     productName: '',
        //     quantity: 0});
        // console.log('new doc detected');

        res.render('login');
    } catch (e) {
    console.error("Error adding document: ", e);
    }
    //alert
    
})

app.post('/submitToLogin',async (req, res) => {
    const emailInput = req.body.email;
    const usersCollection = db.collection('users');
    const passwordInput = req.body.password;
    const user = await usersCollection.where('email', '==', emailInput).get();
    

    if (!user) {
        res.status(401).json({ message: 'email not found' });
    }
    try {
        const snapshotAdmin = await db.collection('Admin_inventory').get();
        const adminData = snapshotAdmin.docs.map((doc) => doc.data());

        const collectionName = `${user.docs[0].data().name}`;
        const snapshotUser = await db.collection('users_inventory').doc(collectionName).collection('product').get();
        const userData = snapshotUser.docs.map((doc) => doc.data());
        if (user) {
            const isPasswordMatch = await bcrypt.compare(passwordInput, user.docs[0].data().password);
            if (!isPasswordMatch) {
                res.status(401).json({ message: 'Password salah' });
            } else {
                currUserName = user.docs[0].data().name;
                res.status(200).render('user_page', { name: user.docs[0].data().name , adminData: adminData, userData: userData });
            }
        }
        else if (req.body.email === "") {
            res.status(401).json({ message: 'email section is empty' });
        }
        else {
            res.status(401).json({ message: 'email not found' });
        }
    } catch (e) {
    console.error("Error login", e);
    }
    
})

app.get('/admin', async(req, res) => {
    try {
        const snapshotUser = await db.collection('users').get(); // Replace with your collection name
        const snapshotAdminInventory = await db.collection('Admin_inventory').get(); // Replace with your collection name
        const userData = snapshotUser.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Map through documents
        const adminInventoryData = snapshotAdminInventory.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        //ribet ambil semua data inventory user karena user terbagi dengan collection berbeda (susah increment collections)
        //future update buat data users inventory menjadi 1 collection

        res.render('adminDashboard', { userData: userData, adminInventoryData: adminInventoryData }); // Pass data to the EJS template
    } catch (err) {
        console.error("Error fetching data:", err);
    }
})
app.post('/add_product', async (req, res) => {   
    const data = {
        productName: req.body.productName,
        quantity: parseInt(req.body.quantity),
    };
    const collectionName = 'Admin_inventory';

    try {
        // Check if the product already exists in the database
        const productAvailability = await db.collection(collectionName)
            .where('productName', '==', data.productName)
            .get();
        
        if (!productAvailability.empty) {
            // Product with the same name exists, update its quantity
            console.log('Product already exists');
            const currDocref = productAvailability.docs[0].ref;
            const currQuantity = productAvailability.docs[0].data().quantity;

            const newData = currQuantity + data.quantity;
            await currDocref.update({ 'quantity': newData });
            // Redirect after updating
            return res.redirect('/admin'); // Use return to exit the function
        }

        // If no matching product, add the new product to the database
        await db.collection(collectionName).doc().set(data);
        res.redirect('/admin');

    } catch (error) {
        console.error("Error adding new product:", error);
        res.status(500).json({ message: 'An error occurred while adding the product' });
    }
});



app.post('/delete_product', async (req, res) => { 
    const data = {
        productNameInput: req.body.productName,
        quantityInput: parseInt(req.body.quantity), 
    };

    try {
        const currData = await db.collection('Admin_inventory').where('productName', '==', data.productNameInput).get();

        if (currData.empty) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const docRef = currData.docs[0].ref;
        const currValue = currData.docs[0].data().quantity;

        const newData = currValue - data.quantityInput;
        if (newData < 0) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        await docRef.update({ quantity: newData });
        // res.status(200).json({ message: 'Product quantity updated successfully' });
        res.redirect('/admin');  

    } catch (err) {
        console.error("Error updating product:", err);
        res.status(500).json({ message: 'An error occurred while updating the product' });
    }
});

app.post('/move_product', async (req, res) => { 
    const data = {
        productNameInput: req.body.productName,
        quantityInput: parseInt(req.body.quantity), 
        receiverName: req.body.receiverName
    };

    try {
        // Get the product from Admin_inventory
        const currData = await db.collection('Admin_inventory')
            .where('productName', '==', data.productNameInput)
            .get();

        if (currData.empty) {
            return res.status(404).json({ message: 'Product not found in Admin inventory' });
        }

        const docRef = currData.docs[0].ref;
        const currValue = currData.docs[0].data().quantity;

        // Calculate the new quantity in Admin inventory after moving the product
        const newData = currValue - data.quantityInput;
        if (newData < 0) {
            return res.status(400).json({ message: 'Not enough stock available' });
        }

        // Define the receiver's inventory collection
        const collectionName = `${data.receiverName}`;
        
        // Check if the product already exists in the receiver's inventory
        let receiverData = await db.collection('users_inventory').doc(collectionName).collection('product')
            .where('productName', '==', data.productNameInput)
            .get();
        
        if (receiverData.empty) {
            // If the product doesn't exist in the receiver's inventory, create a new document
            console.log('Receiver product not found, creating new product entry');
            await db.collection('users_inventory').doc(collectionName).collection('product').add({
                productName: data.productNameInput,
                quantity: data.quantityInput
            });
        } else {
            // If the product exists, update its quantity
            const receiverDocRef = receiverData.docs[0].ref;
            const currValueReceiver = receiverData.docs[0].data().quantity;
            const newDataReceiver = currValueReceiver + data.quantityInput;

            await receiverDocRef.update({ quantity: newDataReceiver });
        }

        // Update the quantity in the Admin inventory
        await docRef.update({ quantity: newData });

        // Redirect or send a success response
        res.redirect('/admin');  

    } catch (err) {
        console.error("Error moving product:", err);
        res.status(500).json({ message: 'An error occurred while moving the product' });
    }
});

app.post('/take_product', async (req, res) => { 
    const data = {
        productNameInput: req.body.productName,
        quantityInput: parseInt(req.body.quantity), 
        nameInput: req.body.name
    };

    try {
        const currAdminData = await db.collection('Admin_inventory')
            .where('productName', '==', data.productNameInput)
            .get();
        console.log(1);
        if (currAdminData.empty) {
            return res.status(404).json({ message: 'Product not found in Admin inventory == unmarked product' });
        }
        console.log(2);
        const AdmindocRef = currAdminData.docs[0].ref;
        const currAdminValue = currAdminData.docs[0].data().quantity;

        // Calculate the new quantity in Admin inventory after moving the product
        const newAdminData = currAdminValue + data.quantityInput;

        // Define the receiver's inventory collection
        const collectionName = `${data.nameInput}`;
        console.log(3);
        // Check if the product already exists in the receiver's inventory
        let userData = await db.collection('users_inventory').doc(collectionName).collection('product')
            .where('productName', '==', data.productNameInput)
            .get();
            console.log(4);
        if (userData.empty) {
            // If the product doesn't exist in the receiver's inventory, create a new document
            return res.status(444).json({ message: 'Product not found in user inventory' });
        } else {
            // If the product exists, update its quantity
            const userDocRef = userData.docs[0].ref;
            const currValueUser = userData.docs[0].data().quantity;
            let newDataUser = currValueUser - data.quantityInput;
            if (newDataUser < 0) {
                return res.status(400).json({ message: 'User doesnt have enough stock' });
            }
            await userDocRef.update({ quantity: newDataUser });
        }
        console.log(5);
        // Update the quantity in the Admin inventory
        await AdmindocRef.update({ quantity: newAdminData });

        // Redirect or send a success response
        res.redirect('/admin');  

    } catch (err) {
        console.error("Error moving product:", err);
        res.status(500).json({ message: 'An error occurred while moving the product' });
    }
});

app.post('/request', async(req, res) => {
    const dataInput = {
        name: req.body.name,
        productName: req.body.productName,
        quantity: req.body.quantity,
        description: req.body.description,
        request: req.body.request
    }
    const collectionName = `${dataInput.name}`;
    const docRef = db.collection('users_inventory').doc(collectionName).collection('request');
    const adminInventoryData = (await db.collection('Admin_inventory').get()).docs.map((doc) => doc.data());
    const userInventoryData = (await db.collection('users_inventory').doc(collectionName).collection('product').get()).docs.map((doc) => doc.data());

    docRef.doc().set(dataInput).then(() => {
        res.status(200).render('user_page', { name: dataInput.name, adminData: adminInventoryData, userData: userInventoryData });
    });

})

// app.use('/',(req, res) => {
//     res.status(404);
//     res.send('404-page not found');
// })

app.listen(port, () => {
    console.log(`listening on port ${port}`);
})