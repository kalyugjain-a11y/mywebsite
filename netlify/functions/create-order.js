const admin = require('firebase-admin');

// Firebase Init
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: "https://free-fire-store-a2403-default-rtdb.firebaseio.com"
    });
  } catch(e) { console.error("Firebase Init Error:", e); }
}
const db = admin.database();

exports.handler = async (event, context) => {
    const headers = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };

    try {
        const { amount, userId, email, redirectUrl } = JSON.parse(event.body);
        const API_KEY = process.env.FAMGATEWAY_API_KEY; 

        const response = await fetch("https://famgateway.in/api/create-order", {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
            body: JSON.stringify({
                amount: amount,
                customer_name: email || "Customer",
                redirect_url: redirectUrl
            })
        });

        const responseText = await response.text();
        if (!response.ok) throw new Error(`FamGateway Error: ${responseText}`);
        
        const data = JSON.parse(responseText);
        
        // ✅ SMART SEARCH: Order ID nikaalo
        function findValue(obj, key) {
            if (!obj || typeof obj !== 'object') return null;
            if (obj[key] !== undefined && obj[key] !== null) return obj[key];
            for (let k in obj) {
                let found = findValue(obj[k], key);
                if (found !== null && found !== undefined) return found;
            }
            return null;
        }

        const orderId = findValue(data, 'order_id') || findValue(data, 'orderId');

        // ✅ MAGIC: Order ko Database mein save karo
        if (orderId && userId) {
            await db.ref(`local_orders/${orderId}`).set({
                uid: userId,
                amount: amount,
                status: 'pending',
                date: new Date().toISOString()
            });
            console.log(`Order ${orderId} saved for user ${userId}`);
        }

        return { statusCode: 200, headers, body: JSON.stringify(data) };

    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: error.message }) };
    }
};
