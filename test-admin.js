const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('public/admin.html', 'utf8');
const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;

// wait a bit
setTimeout(() => {
    console.log("Checking if openKasaTransactionModal is defined:");
    console.log(typeof window.openKasaTransactionModal);
    
    // Simulate empty state data
    window.allClients = [];
    
    try {
        window.openKasaTransactionModal('', 'income');
        console.log("Modal opened successfully.");
    } catch(e) {
        console.error("Error opening modal:", e.message);
    }
}, 500);

