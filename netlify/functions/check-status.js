exports.handler = async (event, context) => {
    const headers = { "Access-Control-Allow-Origin": "*" };
    const orderId = event.queryStringParameters.order_id;
    
    if (!orderId) return { statusCode: 400, headers, body: JSON.stringify({ error: "No order id" }) };

    try {
        const API_KEY = process.env.FAMGATEWAY_API_KEY;
        
        // FamGateway se status check kar rahe hain
        const response = await fetch(`https://famgateway.in/api/verify-order.php?order_id=${orderId}`, {
            method: 'GET',
            headers: { 'X-API-Key': API_KEY }
        });
        
        const responseText = await response.text();
        return { statusCode: 200, headers, body: responseText }; 
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
