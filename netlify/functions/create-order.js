exports.handler = async (event, context) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "OK" };
    }

    try {
        if (!event.body) throw new Error("No body received");
        const { amount, email, redirectUrl } = JSON.parse(event.body);
        
        // ❌ Hardcoded key hatadi, ab Environment Variable se aayegi
        const API_KEY = process.env.FAMGATEWAY_API_KEY; 

        const response = await fetch("https://famgateway.in/api/create-order", {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            body: JSON.stringify({
                amount: amount,
                customer_name: email || "Customer",
                redirect_url: redirectUrl
            })
        });

        const responseText = await response.text();
        
        if (!response.ok) {
            throw new Error(`FamGateway Error (${response.status}): ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error(`Invalid response from gateway: ${responseText}`);
        }

        return { statusCode: 200, headers, body: JSON.stringify(data) };

    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, message: error.message })
        };
    }
};
