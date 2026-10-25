const crypto = require('crypto');
const admin = require('firebase-admin');

// Firebase Init (agar pehle se nahi hua hai)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://free-fire-store-a2403-default-rtdb.firebaseio.com"
  });
}
const db = admin.database();

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const signature = event.headers['x-famgateway-signature'];
    const payload = event.body; 

    // ✅ Tumhari API Key hi Secret hai
    const API_KEY = process.env.FAMGATEWAY_API_KEY || "fam_0b60bb5c4b1bcbe227a6cc9d644b35875d5a17f0";

    // Signature Verify karo
    const expectedSignature = crypto
      .createHmac('sha256', API_KEY)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error("Invalid Webhook Signature");
      return { statusCode: 401, body: 'Invalid Signature' };
    }

    const data = JSON.parse(payload);
    console.log("Webhook Received:", data);

    // Data nikaalo (FamGateway ke format ke hisaab se)
    const orderId = data.order_id || data.data?.order_id;
    const amount = parseFloat(data.amount || data.payable_amount || data.data?.amount || 0);
    const status = data.status || data.data?.status || 'success';

    if (orderId && (status === 'success' || status === 'paid' || data.paid === true)) {
      
      // 1. Check karo ki pehle se process toh nahi hua
      const orderRef = db.ref(`processed_orders/${orderId}`);
      const orderSnap = await orderRef.get();
      
      if (orderSnap.exists()) {
        return { statusCode: 200, body: 'Already Processed' };
      }

      // 2. Order details se UID nikaalo
      // (Maan lete hain tumne checkout ke waqt Firebase mein local_orders/${orderId} save kiya tha)
      const localOrderSnap = await db.ref(`local_orders/${orderId}`).get(); 
      
      if (localOrderSnap.exists()) {
        const { uid } = localOrderSnap.val();
        
        // 3. Lock lagao
        await orderRef.set({ status: 'completed', amount: amount, date: new Date().toISOString() });

        // 4. Balance add karo
        await db.ref(`users/${uid}/balance`).transaction(b => (b || 0) + amount);
        
        // 5. History save karo
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
