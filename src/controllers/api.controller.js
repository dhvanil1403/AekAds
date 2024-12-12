const screen = require("../models/newScreen.model");


const getAllScreensAllData = async (req, res) => {
    try {
      const allScreens = await screen.getAllScreens(); // Assuming this function fetches all screens
  
      // Assuming you want to send allScreens as JSON
      res.json(allScreens);
    } catch (error) {
      console.error("Error fetching all screens:", error);
      res.status(500).send("Error fetching screens");
    }
  };
  const getScreenDataById = async (req, res) => {
    try {
      const id = req.params.id; // Extract ID from request
      console.log(`[Request Received] Fetching screen data for ID: ${id}`);
  
      // Log the received ID
      console.log(`Extracted ID: ${id}`);
  
      // Fetch screen data by ID
      const screenData = await screen.getScreenById(id);
      console.log(`[Database Query] Result for ID ${id}:`, screenData);
  
      // Check if screen data exists
      if (!screenData) {
        console.warn(`[Not Found] Screen with ID ${id} does not exist`);
        return res.status(404).send(`Screen with ID ${id} not found`);
      }
  
      // Log success
      console.log(`[Success] Sending data for screen ID ${id}`);
      res.json(screenData); // Send the screen data as JSON
    } catch (error) {
      // Log errors with stack trace
      console.error(`[Error] An error occurred while fetching screen with ID ${req.params.id}:`, error);
      res.status(500).send("Error fetching screen data");
    }
  };
    
  module.exports={getAllScreensAllData,getScreenDataById};