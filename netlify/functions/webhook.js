const crypto = require('crypto');
const admin = require('firebase-admin');

// Firebase Init Environment Variable se
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      databaseURL: "https://free-fire-store-a2403-default-rtdb.firebaseio.com"
    });
  } catch(e) {
    console.error("Firebase Init Error:", e);
  }
}
const db = admin.database();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const signature = event.headers['x-famgateway-signature'];
    const payload = event.body; 

    // ❌ Hardcoded key hatadi
    const API_KEY = process.env.FAMGATEWAY_API_KEY;

    if (API_KEY && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', API_KEY)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        console.error("Invalid Webhook Signature");
        return { statusCode: 401, body: 'Invalid Signature' };
      }
    }

    const data = JSON.parse(payload);
    console.log("Webhook Received:", data);

    const orderId = data.order_id || data.data?.order_id;
    const amount = parseFloat(data.amount || data.payable_amount || data.data?.amount || 0);
    const status = data.status || data.data?.status || 'success';

    if (orderId && (status === 'success' || status === 'paid' || data.paid === true)) {
      
      const orderRef = db.ref(`processed_orders/${orderId}`);
      const orderSnap = await orderRef.get();
      
      if (orderSnap.exists()) {
        return { statusCode: 200, body: 'Already Processed' };
      }

      const localOrderSnap = await db.ref(`local_orders/${orderId}`).get(); 
      
      if (localOrderSnap.exists()) {
        const { uid } = localOrderSnap.val();
        
        await orderRef.set({ status: 'completed', amount: amount, date: new Date().toISOString() });
        await db.ref(`users/${uid}/balance`).transaction(b => (b || 0) + amount);
        
        await db.ref(`deposit_history/${uid}`).push({
          amount: amount,
          status: 'Success',
          method: 'FamGateway Webhook',
          utr: data.utr || '',
          date: new Date().toISOString()
        });
        
        console.log(`✅ Balance added for user: ${uid}`);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error("Webhook Error:", error);
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }
};
