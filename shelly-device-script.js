// Script to be uploaded to Shelly Pro 3EM device
// This script sends EM data via MQTT at custom intervals
// Minimum interval is 1000ms (1 second)

let SHELLY_ID = undefined;
let INTERVAL_MS = 1000; // Change this to your desired interval (minimum 1000ms)

// Get the MQTT topic prefix
Shelly.call("Mqtt.GetConfig", "", function (res, err_code, err_msg, ud) {
  if (res && res.topic_prefix) {
    SHELLY_ID = res.topic_prefix;
    console.log("MQTT Topic Prefix:", SHELLY_ID);
  } else {
    console.log("Failed to get MQTT config");
  }
});

function timerHandler(user_data) {
  // Get EM status
  let em = Shelly.getComponentStatus("em", 0);
  
  if (em && SHELLY_ID) {
    // Add timestamp to the data
    em.timestamp = Math.floor(Date.now() / 1000);
    
    // Publish to MQTT
    MQTT.publish(SHELLY_ID + "/status/em:0", JSON.stringify(em), 0, false);
    
    console.log("Published EM data at", new Date().toISOString());
  } else {
    console.log("EM data or MQTT not available");
  }
}

// Set timer - change INTERVAL_MS to your desired interval
// Minimum is 1000ms (1 second)
Timer.set(INTERVAL_MS, true, timerHandler, null);

console.log("EM data publisher started with", INTERVAL_MS, "ms interval"); 