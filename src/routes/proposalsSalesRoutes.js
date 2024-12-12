const express = require("express");
const pool = require("../config/dbConnection");
const router = express.Router();
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const fs = require("fs");
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();


// Middleware to check authentication
router.use((req, res, next) => {
  if (!req.session.userId) {
      console.log("erroorrrrr");
    return res.redirect("/login");
  }
  next();
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Set up Multer for file uploads (temporarily storing files in 'uploads/' directory)
const upload = multer({ dest: "uploads/" });



// Configure Multer with Cloudinary Storage
// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     allowed_formats: ['jpg', 'png', 'jpeg','mp4'], // Only allow m4a, m4v, mp4 file formats
//   },
// });



// const upload = multer({ storage: storage });
// Create Proposal Route
router.post("/create", async (req, res) => {
  const {
    clientName,
    startDate,
    slotDuration,
    endDate,
    cities,
    clientType,
    propertyType,
    plan,
    advertiserTag,
    geoTagging,
    popRequired,
  } = req.body;

  const userId = req.session.userId; // Assuming the user ID is stored in session
  console.log("userId", userId);

  try {
    // Insert the proposal data into the PostgreSQL database
    const result = await pool.query(
      `INSERT INTO proposals (
        client_name, start_date, end_date, slot_duration, cities, client_type, property_type, plan, advertiser_tag, geo_tagging,pop_required,user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,$11,$12) RETURNING id`,
      [
        clientName,
        startDate,
        endDate,
        slotDuration,
        cities,
        clientType,
        propertyType,
        plan,
        advertiserTag,
        geoTagging === "on" ? true : false, // Convert checkbox to boolean
        popRequired === "on" ? true : false,
        userId,
      ]
    );

    // res.json({ success: true, proposalId: result.rows[0].id });
    // res.redirect('/')
    // res.render('page2Upload', { proposalId: result.rows[0].id });
    // res.render('page2Upload');

    // Redirect to propertiesSelect page with the proposal ID as a query parameter
    res.redirect(`/proposals/creativeUpload?proposalId=${result.rows[0].id}`);
  } catch (error) {
    console.error("Error saving proposal data:", error);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// View User's Proposals
router.get("/", async (req, res) => {
  try {
      const userId = req.session.userId;
      console.log("userID of proposal",userId);
      
      // Query to select all proposals with status 'pending'
      const result = await pool.query(
          "SELECT * FROM proposals WHERE user_id = $1 AND status = $2 ORDER BY id DESC",
          [userId, 'pending']
      );

      // Query to select all proposals with status 'Pending Activation'
      const selectResult = await pool.query(
          "SELECT * FROM proposals WHERE user_id = $1 AND status = $2",
          [userId, 'Pending Activation']
      );

      // Query to select all proposals with status 'Discarded'
      const discardProposal = await pool.query(
          "SELECT * FROM proposals WHERE user_id = $1 AND status = $2",
          [userId, 'Discarded']
      );

      // Query to select proposals with status 'Waiting for Admin Approval' or 'Active'
      const waitingOrActiveProposals = await pool.query(
          "SELECT * FROM proposals WHERE user_id = $1 AND status IN ($2, $3, $4)",
          [userId, 'Waiting for Admin Approval', 'Active','Edited Active Proposal']
      );


      const screenProposal = await pool.query('select screenid,screenname from screen_proposal order by screenid desc');
      // Ensure all arrays are defined, even if empty
      const pendingProposals = selectResult.rows || [];
      const discardProposals = discardProposal.rows || [];
      const waitingOrActive = waitingOrActiveProposals.rows || [];
// console.log("screenProposal",screenProposal.rows);

      // Render the 'createProposal' view, passing all the proposal categories
      res.render("createProposal", { 
        proposals: result.rows, 
        pendingProposals, 
        discardProposals, 
        waitingOrActive,
        screenProposal: screenProposal.rows || [],
    });
      
  } catch (error) {
      console.error("Error retrieving proposal data:", error);
      res.status(500).json({ success: false, error: "Database error" });
  }
});


router.get("/propertiesSelect", async (req, res) => {
  const proposalId = req.query.proposalID;
console.log("propertiesSelect proposalId",proposalId)
  try {
    const screens = await pool.query(
      `SELECT * 
       FROM public.screen_proposal 
       ORDER BY screenid DESC`
    );

    const selectedProposal = await pool.query(
      "SELECT * FROM public.proposals WHERE id = $1",
      [proposalId]
    );

    const propertiesIds = selectedProposal.rows[0]?.property_ids || [];

    // Process slots to determine allotted and next available slot for each screen
    const screensWithSlots = screens.rows.map(screen => {
      const allottedSlots = [];
      let nextAvailableSlot = null;

      // Loop through slots 1 to 10 to check availability
      for (let i = 1; i <= 10; i++) {
        if (screen[`slot${i}`]) {
          allottedSlots.push(i);
        } else if (!nextAvailableSlot) {
          nextAvailableSlot = i; // Set the first available slot
        }
      }

      return { ...screen, allottedSlots, nextAvailableSlot };
    });

    res.render("screenPropSelection", {
      proposalId,
      screens: screensWithSlots,
      selectedProposal: selectedProposal.rows,
      propertiesIds
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

// // Route to handle updating properties based on proposalID
// router.post("/saveProperties", async (req, res) => {
//   // const {
//   //   proposalID,
//   //   propertyIds,
//   //   propertyNames,
//   //   totalProperties,
//   //   totalScreens,
//   //   totalApproxReach,
//   //   propertyCities,
//   // } = req.body;
//   const {
//     proposalID,
//     screenIds,
   
//     totalScreens,
    
//   } = req.body;

//   // Validate input
//   if (
//     !proposalID ||
//     !screenIds ||
//     !totalScreens 
   
//   ) {
//     return res
//       .status(400)
//       .json({ status: "error", message: "Invalid input data" });
//   }

//   try {
//     // Update the properties in the proposals table
//     // const query = `
//     //   UPDATE public.proposals
//     //   SET 
//     //     property_ids = $2,
//     //     property_names = $3,
//     //     total_properties = $4,
//     //     total_screens = $5,
//     //     total_approx_reach = $6,
//     //     city = $7
//     //   WHERE id = $1
//     //   RETURNING pop_required;
//     // `;
//     const query = `
//     UPDATE public.proposals
//     SET 
//       property_ids = $2,
//       total_screens = $3,
//     WHERE id = $1
//     RETURNING pop_required;
//   `;
//     // const result = await pool.query(query, [
//     //   proposalID,
//     //   propertyIds,
//     //   propertyNames,
//     //   totalProperties,
//     //   totalScreens,
//     //   totalApproxReach,
//     //   propertyCities,
//     // ]);
//     const result = await pool.query(query, [
//       proposalID,
//       screenIds,
//       totalScreens,
//     ]);
//     // Check the value of pop_required and send JSON response
//     const popRequired = result.rows[0].pop_required;
//     res.json({ status: "success", popRequired, proposalID });
//   } catch (error) {
//     console.error("Database Error:", error);
//     res
//       .status(500)
//       .json({ status: "error", message: "Error updating properties" });
//   }
// });




                                    


// router.post("/saveScreens", async (req, res) => {
//   const { proposalID, screenIds, totalScreens,nextAvailableSlots } = req.body;

//   // Log the received data from the request body
//   console.log("Received proposalID:", proposalID);
//   console.log("Received screenIds:", screenIds);
//   console.log("Received totalScreens:", totalScreens);
//   console.log("Received nextAvailableSlots:", nextAvailableSlots);

//   // Validate input
//   if (!proposalID || !screenIds || !totalScreens || !nextAvailableSlots) {
//     console.log("Invalid input data");
//     return res.status(400).json({ status: "error", message: "Invalid input data" });
//   }

//   try {
//     const query = `
//       UPDATE public.proposals
//       SET property_ids = $2, total_screens = $3,property_names = $4
//       WHERE id = $1
//       RETURNING pop_required;
//     `;

//     // Log query parameters before executing
//     console.log("Executing query with parameters:", [proposalID, screenIds, totalScreens,nextAvailableSlots]);

//     const result = await pool.query(query, [proposalID, screenIds, totalScreens, nextAvailableSlots]);

//     // Log the result of the query
//     console.log("Query Result:", result.rows);

//     const popRequired = result.rows[0].pop_required;

//     res.json({ status: "success", popRequired, proposalID });
//   } catch (error) {
//     console.error("Database Error:", error);
//     res.status(500).json({ status: "error", message: "Error updating properties" });
//   }
// });














router.post("/saveScreens", async (req, res) => {
      
  const { proposalID, screenIds, totalScreens, nextAvailableSlots,totalReach,uniqueLocationsCount } = req.body;

  console.log("Received request data:", { proposalID, screenIds, totalScreens, nextAvailableSlots,totalReach,uniqueLocationsCount });

  if (!proposalID || !screenIds || !totalScreens || !nextAvailableSlots || !totalReach || !uniqueLocationsCount) {
    console.log("Invalid input data: Missing required fields.");
    return res.status(400).json({ status: "error", message: "Invalid input data" });
  }

  try {
    // Step 1: Verify slot availability
    const slotAvailabilityQuery = `
      SELECT screenid, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8, slot9, slot10
      FROM screen_proposal
      WHERE screenid = ANY($1)
    `;

    const slotCheckResult = await pool.query(slotAvailabilityQuery, [screenIds]);


    // Step 1a: Check availability for each selected screen and slot
    const unavailableScreens = [];

    for (let i = 0; i < screenIds.length; i++) {
      const screenID = screenIds[i];
      const slotNumber = nextAvailableSlots[i];
      const slotKey = `slot${slotNumber}`;

      const screenData = slotCheckResult.rows.find(screen => screen.screenid == screenID);
console.log("screenData",screenData);

      if (screenData) {
        if (screenData[slotKey] !== null) { // If the slot is already occupied
          unavailableScreens.push({
            screenID,
            slot: slotNumber,
          });
        }
      } else {
        unavailableScreens.push({
          screenID,
          slot: slotNumber,
        });
      }
    }

    if (unavailableScreens.length > 0) {
      const details = unavailableScreens.map(screen => ({
        screenID: screen.screenID,
        slot: screen.slot,
      }));
      console.log("Unavailable slots found:", details);
      return res.status(400).json({
        status: "error",
        message: "Some selected screens have no available slots.",
        details,
      });
    }

    // Step 2: Fetch proposal data
    const proposalQuery = "SELECT * FROM proposals WHERE id = $1";
    console.log("Fetching proposal data with query:", proposalQuery);
    const proposalResult = await pool.query(proposalQuery, [proposalID]);
    console.log("Proposal data result:", proposalResult.rows);

    if (proposalResult.rows.length === 0) {
      console.log("Proposal not found for ID:", proposalID);
      return res.status(404).json({ status: "error", message: "Proposal not found" });
    }

    const proposalData = proposalResult.rows[0];
    const mergedUrls = [
      proposalData.url1,
      proposalData.url2,
      proposalData.url3,
      proposalData.url4,
    ].filter(Boolean);

    console.log("Merged URLs from proposal:", mergedUrls);

    const startDate = new Date(proposalData.start_date);
    const endDate = proposalData.end_date
      ? new Date(proposalData.end_date)
      : new Date(startDate.setDate(startDate.getDate() + proposalData.duration_days));
    console.log("Start date:", startDate, "End date:", endDate);

    // Step 3: Update screen slots
    for (let i = 0; i < screenIds.length; i++) {
      const screenID = screenIds[i];
      const slotNumber = nextAvailableSlots[i];
      const slotField = `slot${slotNumber}`;
      const slotStartField = `slot${slotNumber}_startdate`;
      const slotEndField = `slot${slotNumber}_enddate`;
      const slotClientField = `slot${slotNumber}_clientname`;

      const updateScreenQuery = `
        UPDATE screen_proposal
        SET ${slotField} = $1,
            ${slotStartField} = $2,
            ${slotEndField} = $3,
            ${slotClientField} = $4
        WHERE screenid = $5
      `;
      console.log(`Updating screen ${screenID} slot ${slotNumber} with query:`, updateScreenQuery);

      await pool.query(updateScreenQuery, [
        JSON.stringify(mergedUrls),
        startDate.toISOString().split("T")[0],
        endDate.toISOString().split("T")[0],
        proposalData.client_name,
        screenID,
      ]);
    }

    // Step 4: Update proposal data
    const updateProposalQuery = `
      UPDATE public.proposals
      SET property_ids = $2, total_screens = $3, property_names = $4, total_approx_reach = $5,total_properties = $6
      WHERE id = $1
      RETURNING pop_required
    `;
    console.log("Updating proposal with query:", updateProposalQuery);

    const proposalUpdateResult = await pool.query(updateProposalQuery, [
      proposalID,
      screenIds,
      totalScreens,
      nextAvailableSlots,
      totalReach,
      uniqueLocationsCount
    ]);
    console.log("Proposal update result:", proposalUpdateResult.rows);

    const popRequired = proposalUpdateResult.rows[0]?.pop_required;

    res.json({
      status: "success",
      message: "Screens updated successfully",
      popRequired,
      proposalID,
    });
  } catch (error) {
    console.error("Error while saving screens:", error);
    res.status(500).json({
      status: "error",
      message: "An unexpected error occurred. Please try again or contact support.",
    });
  }
});













router.get("/popRequired", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT pop_required, pop_dates, pop_properties, pop_screens, pop_geo_tagging, pop_newspaper_proof, pop_instruction FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    // Log the structure of selectedProposal
    console.log("Selected Proposal Structure:", selectedProposal.rows); // Log the rows returned

    res.render("popRequired", {
      proposalID,
      selectedProposal: selectedProposal.rows,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/pricing", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT price,total_screens,order_value,end_date FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    // Log the structure of selectedProposal
    console.log("Selected Proposal Structure:", selectedProposal.rows); // Log the rows returned

    res.render("pricingPage", {
      proposalID,
      selectedProposal: selectedProposal.rows,
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/popSubmit", async (req, res) => {
  try {
    const {
      proposalID,
      pop_dates,
      pop_properties,
      pop_screens,
      pop_geo_tagging,
      pop_newspaper_proof,
      pop_instruction,
    } = req.body;

    // Validate proposalID
    if (!proposalID) {
      return res.status(400).json({ error: "proposalID is required" });
    }

    // Log the data
    // console.log('Updating proposal with ID:', proposalID);
    // console.log('Request body:', req.body);

    const updateQuery = `
          UPDATE proposals
          SET 
              pop_dates = $1,
              pop_properties = $2,
              pop_screens = $3,
              pop_geo_tagging = $4,
              pop_newspaper_proof = $5,
              pop_instruction = $6
          WHERE id = $7
      `;

    await pool.query(updateQuery, [
      pop_dates,
      pop_properties,
      pop_screens,
      pop_geo_tagging,
      pop_newspaper_proof,
      pop_instruction,
      proposalID,
    ]);

    res.status(200).json({ message: "Proposal updated successfully" });
  } catch (error) {
    console.error("Error updating proposal:", error.message);
    res.status(500).json({ error: "Failed to update proposal" });
  }
});

// Route to handle form submission
router.post("/priceSubmit", async (req, res) => {
  const { price, proposalID,orderValue } = req.body;

  try {
    const updateQuery = `
      UPDATE proposals
      SET 
        price = $1,
        order_value = $2
      WHERE id = $3
    `;

    await pool.query(updateQuery, [price,orderValue, proposalID]);

    res.status(200).json({ message: "Proposal price updated successfully" });
  } catch (error) {
    console.error("Error updating proposal:", error.message);
    res.status(500).json({ error: "Failed to update price proposal" });
  }
});

// Route to handle purchaseOrderSubmit submission
router.post(
  "/purchaseOrderSubmit",
  upload.single("purchaseOrder"),
  async (req, res) => {
    const { proposalID, existingFileURL, originalfileName } = req.body;
    const file = req.file;

    // Validate that proposalID is provided
    if (!proposalID) {
      return res.status(400).json({ error: "Proposal ID is required" });
    }

    try {
      let pdfFileUrl = existingFileURL; // Default to the existing file URL
      let updatedOriginalFileName = originalfileName; // Default to the original file name

      // If a new file is uploaded, process it
      if (file) {
        const resourceType = file.mimetype ===  "auto"; // Dynamically set resource type

        // Upload to Cloudinary
        const cloudinaryResult = await cloudinary.uploader.upload(file.path, {
          folder: "proposals",
          resource_type: resourceType, // Handle PDFs and other file types
        });

        // Use the Cloudinary URL and file name
        pdfFileUrl = cloudinaryResult.secure_url;
        updatedOriginalFileName = file.originalname;

        
      }

      // Prepare the SQL query to update the proposal in the database
      const query = `
        UPDATE proposals
        SET  pdf_file_url = $1, pdf_original_file_name = $2
        WHERE id = $3;
      `;
      const values = [ pdfFileUrl, updatedOriginalFileName, proposalID];

      // Execute the query to update the proposal
      const dbResult = await pool.query(query, values);

      // Check if the proposal was found and updated
      if (dbResult.rowCount === 0) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      // If a new file was uploaded, delete the local file
      if (file) {
        fs.unlinkSync(file.path); // Safely delete the file after upload
      }

      // Respond with the updated PDF link
      res.status(200).json({
        message: "Proposal updated successfully",
        pdfPreviewUrl: pdfFileUrl, // Return the PDF preview link
      });
    } catch (error) {
      console.error("Error while updating proposal:", error);
      res.status(500).json({ error: "An error occurred while updating the proposal" });
    }
  }
);




router.get("/purchaseOrder", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT order_value, pdf_file_url, pdf_original_file_name FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    console.log("Selected Proposal Structure:", selectedProposal.rows); // Log the rows returned

    const proposalData =
      selectedProposal.rows.length > 0 ? selectedProposal.rows[0] : null;

    res.render("purchase", {
      proposalID,
      proposalData, // Pass the proposal data to the template
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/clientPOC", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT poc_name, poc_designation, poc_contact, poc_alt_contact, poc_city, poc_email FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    // Log the structure of selectedProposal
    console.log("Selected Proposal Structure:", selectedProposal.rows); // Log the rows returned

    res.render("clientPOC", {
      proposalID,
      selectedProposal: selectedProposal.rows[0] || {},
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/clientPOCFormSubmit", async (req, res) => {
  const {
    proposalID,
    clientPOCName,
    clientPOCDesignation,
    clientPOCContact,
    clientPOCAltContact,
    clientPOCCity,
    clientPOCEmail,
  } = req.body;
  // Validate proposalID
  if (!proposalID) {
    return res.status(400).json({ error: "proposalID is required" });
  }

  console.log("in clientPOCFormSubmit");

  try {
    const query = `
    UPDATE proposals
          SET 
              poc_name = $1,
              poc_designation = $2,
              poc_contact = $3,
              poc_alt_contact = $4,
              poc_city = $5,
              poc_email = $6
          WHERE id = $7
    `;

    const values = [
      clientPOCName,
      clientPOCDesignation,
      clientPOCContact,
      clientPOCAltContact || null,
      clientPOCCity,
      clientPOCEmail,
      proposalID,
    ];
    const result = await pool.query(query, values);

    res
      .status(200)
      .json({ message: "Proposal CLient POC updated successfully" });
  } catch (err) {
    console.error("Error inserting POC Client data:", err);
    res.status(500).send("Error saving data to database.");
  }
});

router.get("/creativeUpload", async (req, res) => {
  const proposalID = req.query.proposalId; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT url1, url2, url3, url4, creative_instruction FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    console.log("Received proposalID:", proposalID);
    console.log("Selected Proposal Structure:", selectedProposal.rows);

    if (selectedProposal.rows.length === 0) {
      return res.status(404).send("Proposal not found");
    }

    res.render("creativeUpload", {
      proposalID,
      selectedProposal: selectedProposal.rows[0],
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});



// router.post("/creativeUploadSubmit", upload.array("newFiles", 5), async (req, res) => {
//   const { proposalID, creativeInstruction, deletedExistingFiles } = req.body;

//   // Parse existing files and deleted files if they exist
//   let existingFiles = [];
//   let deletedFiles = [];
//   try {
//     existingFiles = JSON.parse(req.body.existingFiles || "[]");
//     deletedFiles = JSON.parse(deletedExistingFiles || "[]");
//   } catch (parseError) {
//     console.error("Error parsing existing or deleted files:", parseError);
//     return res.status(400).json({ error: "Invalid format for existing or deleted files" });
//   }

//   // Filter out the deleted files from the existing files array
//   let mediaURLs = existingFiles.filter(url => !deletedFiles.includes(url));

//   // Add newly uploaded files to mediaURLs
//   req.files.forEach(file => {
//     mediaURLs.push(file.path);
//   });

//   // Limit mediaURLs to a maximum of 5 entries
//   mediaURLs = mediaURLs.slice(0, 5);

//   try {
//     // Check if the proposal exists in the database
//     const result = await pool.query("SELECT * FROM public.proposals WHERE id = $1", [proposalID]);

//     if (result.rows.length > 0) {
//       // Update existing proposal
//       await pool.query(
//         `UPDATE public.proposals
//          SET url1 = $1, url2 = $2, url3 = $3, url4 = $4, url5 = $5, creative_instruction = $6
//          WHERE id = $7`,
//         [
//           mediaURLs[0] || null,
//           mediaURLs[1] || null,
//           mediaURLs[2] || null,
//           mediaURLs[3] || null,
//           mediaURLs[4] || null,
//           creativeInstruction,
//           proposalID
//         ]
//       );
//       res.json({ message: "Proposal updated successfully" });
//     } else {
//       // Insert new proposal
//       await pool.query(
//         `INSERT INTO public.proposals (id, url1, url2, url3, url4, url5, creative_instruction)
//          VALUES ($1, $2, $3, $4, $5, $6, $7)`,
//         [
//           proposalID,
//           mediaURLs[0] || null,
//           mediaURLs[1] || null,
//           mediaURLs[2] || null,
//           mediaURLs[3] || null,
//           mediaURLs[4] || null,
//           creativeInstruction
//         ]
//       );
//       res.json({ message: "Proposal created successfully" });
//     }
//   } catch (error) {
//     console.error("Error updating/creating proposal:", error);
//     res.status(500).json({ error: "Internal Server Error", details: error.message });
//   }
// });



// Route to handle creativeUploadSubmit submission
// POST route for form submission
router.post("/creativeUploadSubmit", upload.array("newFiles", 4), async (req, res) => {
  const { proposalID, creativeInstruction, deletedExistingFiles } = req.body;
  const existingFiles = JSON.parse(req.body.existingFiles || "[]"); // Existing file URLs
  const newFiles = req.files; // Newly uploaded files
  let mediaURLs = existingFiles; // Start with existing files that weren't deleted

  console.log("Received data:");
  console.log("Proposal ID:", proposalID);
  console.log("Creative Instruction:", creativeInstruction);
  console.log("Deleted Existing Files:", deletedExistingFiles);
  console.log("New Files:", newFiles);

  try {
      // Remove deleted files from the list
      if (deletedExistingFiles) {
          const deletedFiles = JSON.parse(deletedExistingFiles);
          mediaURLs = mediaURLs.filter(url => !deletedFiles.includes(url));
      }

      // Upload new files to Cloudinary
      const uploadPromises = newFiles.map((file) => {
          return cloudinary.uploader.upload(file.path, { resource_type: "auto" });
      });

      const uploadedFiles = await Promise.all(uploadPromises);

      uploadedFiles.forEach((file, index) => {
          mediaURLs.push(file.secure_url);
          fs.unlinkSync(newFiles[index].path); // Remove file from the server after uploading
      });

      // Only keep up to 5 files (existing + new)
      mediaURLs = mediaURLs.slice(0, 4);

      // Check if proposal exists
      const result = await pool.query("SELECT * FROM public.proposals WHERE id = $1", [proposalID]);

      if (result.rows.length > 0) {
          // Update proposal
          await pool.query(
              `UPDATE public.proposals
               SET url1 = $1, url2 = $2, url3 = $3, url4 = $4, creative_instruction = $5
               WHERE id = $6`,
              [
                  mediaURLs[0] || null,
                  mediaURLs[1] || null,
                  mediaURLs[2] || null,
                  mediaURLs[3] || null,
                  creativeInstruction,
                  proposalID
              ]
          );
          res.json({ message: "Proposal updated successfully" });
      } else {
          // Create new proposal
          await pool.query(
              `INSERT INTO public.proposals (id, url1, url2, url3, url4, creative_instruction)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                  proposalID,
                  mediaURLs[0] || null,
                  mediaURLs[1] || null,
                  mediaURLs[2] || null,
                  mediaURLs[3] || null,
                  creativeInstruction
              ]
          );
          res.json({ message: "Proposal created successfully" });
      }
  } catch (error) {
      console.error("Error updating/creating proposal:", error);
      res.status(500).json({ error: "Internal Server Error" });
  }
});






































router.get("/summaryPage", async (req, res) => {
  const proposalID = req.query.proposalID;

  try {
    // Query the database for proposal details
    const result = await pool.query(
      `SELECT * FROM public.proposals WHERE id = $1`,
      [proposalID]
    );

    if (result.rows.length > 0) {
      const proposal = result.rows[0]; // Get the first result
      // Render the EJS page with the proposal data
      res.render("summary", { proposal });
    } else {
      res.status(404).send("Proposal not found");
    }
  } catch (error) {
    console.error("Error fetching proposal: ", error);
    res.status(500).send("Internal Server Error");
  }
});














// Pending Activation Route
// router.post('/SetpendingActivation', async (req, res) => {
//   const { proposalId } = req.body;
//   // try {
//   //     const updateResult = await pool.query(
//   //         'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
//   //         ['Pending Activation', proposalId]
//   //     );

//   //     if (updateResult.rows.length === 0) {
//   //         return res.status(404).json({ message: 'Proposal not found' });
//   //     }

//   //     // Return the updated proposal as JSON
//   //     res.json({ message: 'Proposal updated successfully', updatedProposal: updateResult.rows[0] });
//   // } catch (error) {
//   //     console.error(error);
//   //     res.status(500).json({ message: 'Error updating proposal' });
//   // }


//   try {
//     // Step 1: Fetch proposal data by proposalId
//     const proposalResult = await pool.query(
//         'SELECT * FROM proposals WHERE id = $1',
//         [proposalId]
//     );
//     console.log('Proposal data result:', proposalResult.rows);

//     if (proposalResult.rows.length === 0) {
//         console.log('Proposal not found');
//         return res.status(404).json({ message: 'Proposal not found' });
//     }

//     const proposalData = proposalResult.rows[0];

//     // Step 2: Merge URLs into one array
//     const mergedUrls = [
//         proposalData.url1, 
//         proposalData.url2, 
//         proposalData.url3, 
//         proposalData.url4, 
//         proposalData.url5
//     ].filter(Boolean); // Filters out null/undefined URLs
//     console.log('Merged URLs:', mergedUrls);

//     // Step 3: Get propertiesIds and propertiesNames
//     const propertiesIds = proposalData.property_ids;
//     const propertiesNames = proposalData.property_names;
//     console.log('Properties IDs:', propertiesIds);
//     console.log('Properties Names:', propertiesNames);

//     // Step 4: Search in screens table for matching screenIds
//     const screensResult = await pool.query(
//         'SELECT * FROM screens WHERE screenid = ANY($1)',
//         [propertiesIds]
//     );
//     console.log('Screens matching propertiesIds:', screensResult.rows.length);

//     // Step 5: Update each screen slot based on its property name
//     for (const screen of screensResult.rows) {
//         // Find the index of the current screen's ID in propertiesIds
//         const screenIndex = propertiesIds.indexOf(screen.screenid.toString());
        
//         if (screenIndex !== -1) {
//             // Use the property name at the found index to determine the slot number
//             const slotNumber = propertiesNames[screenIndex];
//             if (slotNumber) {
//                 const slotField = `slot${slotNumber}`;
//                 // console.log(`Processing screen with screenid ${screen.screenid}, filling ${slotField} with merged URLs:`, mergedUrls);

//                 // Update the specified slot in the screen
//                 await pool.query(
//                     `UPDATE screens SET ${slotField} = $1  WHERE screenid = $2`,
//                     [JSON.stringify(mergedUrls), screen.screenid]
//                 );

//                 console.log(`Updated screenid ${screen.screenid} with merged URLs in ${slotField}`);
//             }
//         }
//     }

//     // Step 6: Update the proposal status to 'Active'
//     const updateResult = await pool.query(
//               'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
//               ['Pending Activation', proposalId]
//           );
//     console.log('Proposal status updated to Pending Activation:', updateResult.rows[0]);

//     // Prepare the response data
//     const response = {
//         message: 'Proposal approved successfully',
//         updatedProposal: updateResult.rows[0],
//         mergedUrls,
//         propertiesIds,
//         propertiesNames,
//         updatedScreens: screensResult.rows
//     };

//     // Send the response
//     res.json(response);

// } catch (error) {
//     console.error('Error during update:', error);
//     res.status(500).json({ message: 'Error updating proposal' });
// }
// });

router.post('/SetpendingActivation', async (req, res) => {
  const { proposalId } = req.body; // Only proposalId comes from the request body

  try {
      // Step 1: Fetch proposal data by proposalId
      const proposalResult = await pool.query(
          'SELECT * FROM proposals WHERE id = $1',
          [proposalId]
      );
      console.log('Proposal data result:', proposalResult.rows);

      if (proposalResult.rows.length === 0) {
          console.log('Proposal not found');
          return res.status(404).json({ message: 'Proposal not found' });
      }

      const proposalData = proposalResult.rows[0];

      // Step 2: Merge URLs into one array
      const mergedUrls = [
          proposalData.url1, 
          proposalData.url2, 
          proposalData.url3, 
          proposalData.url4, 
      ].filter(Boolean); // Filters out null/undefined URLs
      console.log('Merged URLs:', mergedUrls);

      // Step 3: Get propertiesIds and propertiesNames
      const propertiesIds = proposalData.property_ids;
      const propertiesNames = proposalData.property_names;
      console.log('Properties IDs:', propertiesIds);
      console.log('Properties Names:', propertiesNames);

      // Fetch client_name, start_date, and end_date from proposalData
      const clientName = proposalData.client_name;
      const startDate = new Date(proposalData.start_date); // Convert start_date to Date object
      const durationInDays = proposalData.end_date; // end_date is treated as the number of days after start_date
      console.log('Client Name:', clientName);
      console.log('Start Date:', startDate);

      // Calculate the end date by adding the number of days (durationInDays) to the start date
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + durationInDays); // Adds the number of days to the start date

      console.log('Calculated End Date:', endDate);

      // Step 4: Search in screens table for matching screenIds
      const screensResult = await pool.query(
          'SELECT * FROM screen_proposal WHERE screenid = ANY($1)',
          [propertiesIds]
      );
      console.log('Screens matching propertiesIds:', screensResult.rows.length);

      // Step 5: Update each screen slot based on its property name
      for (const screen of screensResult.rows) {
          // Find the index of the current screen's ID in propertiesIds
          const screenIndex = propertiesIds.indexOf(screen.screenid.toString());
          
          if (screenIndex !== -1) {
              // Use the property name at the found index to determine the slot number
              const slotNumber = propertiesNames[screenIndex];
              if (slotNumber) {
                  const slotField = `slot${slotNumber}`;
                  const slotStartDateField = `slot${slotNumber}_startDate`;
                  const slotEndDateField = `slot${slotNumber}_endDate`;
                  const slotClientNameField = `slot${slotNumber}_clientname`;

                  // Format endDate back to YYYY-MM-DD
                  const endDateFormatted = endDate.toISOString().split('T')[0];

                  // Update the specified slot in the screen
                  await pool.query(
                      `UPDATE screen_proposal 
                       SET ${slotField} = $1,
                           ${slotStartDateField} = $2,
                           ${slotEndDateField} = $3,
                           ${slotClientNameField} = $4
                       WHERE screenid = $5`,
                      [JSON.stringify(mergedUrls), startDate.toISOString().split('T')[0], endDateFormatted, clientName, screen.screenid]
                  );

                  console.log(`Updated screenid ${screen.screenid} with merged URLs in ${slotField}, start date in ${slotStartDateField}, end date in ${slotEndDateField}, client name in ${slotClientNameField}`);
              }
          }
      }

      // Step 6: Update the proposal status to 'Pending Activation'
      const updateResult = await pool.query(
          'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
          ['Pending Activation', proposalId]
      );
      console.log('Proposal status updated to Pending Activation:', updateResult.rows[0]);

      // Prepare the response data
      const response = {
          message: 'Proposal approved successfully',
          updatedProposal: updateResult.rows[0],
          mergedUrls,
          propertiesIds,
          propertiesNames,
          updatedScreens: screensResult.rows
      };

      // Send the response
      res.json(response);

  } catch (error) {
      console.error('Error during update:', error);
      res.status(500).json({ message: 'Error updating proposal' });
  }
});



router.post('/SetDiscarded', async (req, res) => {
  // const { proposalId } = req.body;
  // try {
  //     const updateResult = await pool.query(
  //         'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
  //         ['Discarded', proposalId]
  //     );

  //     if (updateResult.rows.length === 0) {
  //         return res.status(404).json({ message: 'Proposal not found' });
  //     }

  //     res.json({ message: 'Proposal discarded successfully', discardedProposal: updateResult.rows[0] });
  // } catch (error) {
  //     console.error(error);
  //     res.status(500).json({ message: 'Error discarding proposal' });
  // }

  
  
  const { proposalId } = req.body; // Only proposalId comes from the request body
  console.log('SetDiscarded in function ');

  try {
      // Step 1: Fetch proposal data by proposalId
      const proposalResult = await pool.query(
          'SELECT * FROM proposals WHERE id = $1',
          [proposalId]
      );
      console.log('Proposal data result:', proposalResult.rows);

      if (proposalResult.rows.length === 0) {
          console.log('Proposal not found');
          return res.status(404).json({ message: 'Proposal not found' });
      }

      const proposalData = proposalResult.rows[0];

      // // Step 2: Merge URLs into one array
      // const mergedUrls = [
      //     proposalData.url1, 
      //     proposalData.url2, 
      //     proposalData.url3, 
      //     proposalData.url4, 
      //     proposalData.url5
      // ].filter(Boolean); // Filters out null/undefined URLs
      // console.log('Merged URLs:', mergedUrls);

      // Step 3: Get propertiesIds and propertiesNames
      const propertiesIds = proposalData.property_ids;
      const propertiesNames = proposalData.property_names;
      console.log('Properties IDs:', propertiesIds);
      console.log('Properties Names:', propertiesNames);

      // Fetch client_name, start_date, and end_date from proposalData
      // const clientName = proposalData.client_name;
      // const startDate = new Date(proposalData.start_date); // Convert start_date to Date object
      // const durationInDays = proposalData.end_date; // end_date is treated as the number of days after start_date
      // console.log('Client Name:', clientName);
      // console.log('Start Date:', startDate);

      // // Calculate the end date by adding the number of days (durationInDays) to the start date
      // const endDate = new Date(startDate);
      // endDate.setDate(startDate.getDate() + durationInDays); // Adds the number of days to the start date

      // console.log('Calculated End Date:', endDate);

      // Step 4: Search in screens table for matching screenIds
      const screensResult = await pool.query(
          'SELECT * FROM screen_proposal WHERE screenid = ANY($1)',
          [propertiesIds]
      );
      console.log('Screens matching propertiesIds:', screensResult.rows.length);

      // Step 5: Update each screen slot based on its property name
      for (const screen of screensResult.rows) {
          // Find the index of the current screen's ID in propertiesIds
          const screenIndex = propertiesIds.indexOf(screen.screenid.toString());
          
          if (screenIndex !== -1) {
              // Use the property name at the found index to determine the slot number
              const slotNumber = propertiesNames[screenIndex];
              if (slotNumber) {
                  const slotField = `slot${slotNumber}`;
                  const slotStartDateField = `slot${slotNumber}_startDate`;
                  const slotEndDateField = `slot${slotNumber}_endDate`;
                  const slotClientNameField = `slot${slotNumber}_clientname`;

                  // Format endDate back to YYYY-MM-DD
                  // const endDateFormatted = endDate.toISOString().split('T')[0];

                  // Update the specified slot in the screen
                  await pool.query(
                      `UPDATE screen_proposal 
                       SET ${slotField} = $1,
                           ${slotStartDateField} = $2,
                           ${slotEndDateField} = $3,
                           ${slotClientNameField} = $4
                       WHERE screenid = $5`,
                      [null, null, null, null, screen.screenid]
                  );

                  console.log(`Updated screenid ${screen.screenid} with merged URLs in ${slotField}, start date in ${slotStartDateField}, end date in ${slotEndDateField}, client name in ${slotClientNameField}`);
              }
          }
      }

      // Step 6: Update the proposal status to 'Pending Activation'
      const updateResult = await pool.query(
          'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
          ['Discarded', proposalId]
      );
      console.log('Proposal status updated to Proposal discarded successfully:', updateResult.rows[0]);

      // Prepare the response data
      const response = {
          message: 'Proposal discarded successfully',
          discardedProposal: updateResult.rows[0],
        
          propertiesIds,
          propertiesNames,
          updatedScreens: screensResult.rows
      };

      // Send the response
      res.json(response);

  } catch (error) {
      console.error('Error during discarded update:', error);
      res.status(500).json({ message: 'Error discarded proposal' });
  }
});


router.post('/setToAdminAproval', async (req, res) => {
  const { proposalId } = req.body;

  console.log("sales side setToAdminAproval");
  
  try {
      const updateResult = await pool.query(
          'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
          ['Waiting for Admin Approval', proposalId] // New status is set here
      );

      if (updateResult.rows.length === 0) {
          return res.status(404).json({ message: 'Proposal not found' });
      }

      // Return the updated proposal as JSON
      res.json({ message: 'Proposal updated successfully', updatedProposal: updateResult.rows[0] });
  } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error updating proposal' });
  }
});










router.get("/creativeUploadEdit", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  try {
    const selectedProposal = await pool.query(
      "SELECT url1, url2, url3, url4, creative_instruction FROM public.proposals WHERE id = $1",
      [proposalID]
    );

    // Log the structure of selectedProposal for debugging
    console.log("Selected  Proposal that can be edit Structure:", selectedProposal.rows); // Log the rows returned

    // Passing data to EJS template
    res.render("creativeUploadEdit", {
      proposalID,
      selectedProposal: selectedProposal.rows[0], // assuming you only need the first row
    });
  } catch (error) {
    console.error("Error fetching proposal:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to handle creativeUploadEdittedSubmit submission
router.post("/creativeUploadEdittedSubmit", upload.array("newFiles", 4), async (req, res) => {
  const { proposalID, creativeInstruction, deletedExistingFiles } = req.body;
  const existingFiles = JSON.parse(req.body.existingFiles || "[]");
  const newFiles = req.files || []; // Ensure newFiles is an array
  let mediaURLs = [...existingFiles]; // Clone existing files

  console.log("Received data of Edited Active Proposals:");
  console.log("Proposal ID:", proposalID);
  console.log("Creative Instruction:", creativeInstruction);
  console.log("Deleted Existing Files:", deletedExistingFiles);
  console.log("New Files:", newFiles);

  try {
    // Remove deleted files from the list
    if (deletedExistingFiles) {
      const deletedFiles = JSON.parse(deletedExistingFiles);

      // If there are deleted files, initialize mediaURLs to an empty array
      if (deletedFiles.length > 0) {
        mediaURLs = [];
      } else {
        // Otherwise, filter out the deleted files from the existing URLs
        mediaURLs = mediaURLs.filter(url => !deletedFiles.includes(url));
      }
    }

    // Upload new files to Cloudinary
    const uploadPromises = newFiles.map((file) =>
      cloudinary.uploader.upload(file.path, { resource_type: "auto" })
    );

    const uploadedFiles = await Promise.all(uploadPromises);

    // Add uploaded file URLs to mediaURLs
    uploadedFiles.forEach((file, index) => {
      mediaURLs.push(file.secure_url);
      try {
        fs.unlinkSync(newFiles[index].path); // Safely remove uploaded files
      } catch (err) {
        console.error("Error removing file:", err);
      }
    });

    // Only keep up to 4 files (existing + new)
    mediaURLs = mediaURLs.slice(0, 4);

    // Check if proposal exists
    const result = await pool.query("SELECT * FROM public.proposals WHERE id = $1", [proposalID]);

    if (result.rows.length > 0) {
      // Update proposal
      await pool.query(
        `UPDATE public.proposals
         SET url1 = $1, url2 = $2, url3 = $3, url4 = $4, creative_instruction = $5, status = 'Edited Active Proposal'
         WHERE id = $6`,
        [
          mediaURLs[0] || null,
          mediaURLs[1] || null,
          mediaURLs[2] || null,
          mediaURLs[3] || null,
          creativeInstruction,
          proposalID
        ]
      );
      res.json({ message: "Proposal updated successfully" });
    } else {
      // Create new proposal
      await pool.query(
        `INSERT INTO public.proposals (id, url1, url2, url3, url4, creative_instruction)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          proposalID,
          mediaURLs[0] || null,
          mediaURLs[1] || null,
          mediaURLs[2] || null,
          mediaURLs[3] || null,
          creativeInstruction
        ]
      );
      res.json({ message: "Proposal created successfully" });
    }
  } catch (error) {
    console.error("Error updating/creating proposal:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});




router.get("/extendProposal", async (req, res) => {
  const proposalID = req.query.proposalID; // Extracting proposalID

  // try {
  //   const selectedProposal = await pool.query(
  //     "SELECT url1, url2, url3, url4, url5, creative_instruction FROM public.proposals WHERE id = $1",
  //     [proposalID]
  //   );

  //   // Log the structure of selectedProposal for debugging
  //   console.log("Selected  Proposal that can be edit Structure:", selectedProposal.rows); // Log the rows returned

  //   // Passing data to EJS template
  //   res.render("creativeUploadEdit", {
  //     proposalID,
  //     selectedProposal: selectedProposal.rows[0], // assuming you only need the first row
  //   });
  // } catch (error) {
  //   console.error("Error fetching proposal:", error);
  //   res.status(500).send("Internal Server Error");
  // }
});































const PDFDocument = require('pdfkit');
const path = require('path');
const axios = require('axios');



async function downloadImage(url, tempFilePath) {
  const writer = fs.createWriteStream(tempFilePath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Function to generate the PDF
// Function to generate the PDF
const moment = require('moment'); // Ensure you have moment.js or date-fns installed
function generateQuotationPDF(proposal, screens, outputFilePath) {
  const doc = new PDFDocument({ margin: 50 });

  // Pipe the output to a file
  doc.pipe(fs.createWriteStream(outputFilePath));

  console.log("Generating PDF for Proposal ID:", proposal.proposal_id);
  
  // Path to the logo
  const logoPath = path.join(__dirname, '1.png'); // Adjust this path if necessary

  // Validate the logo file
  if (!fs.existsSync(logoPath)) {
    console.error(`Logo file not found at ${logoPath}`);
    throw new Error(`Logo file not found at ${logoPath}`);
  }
  console.log("Logo file found at:", logoPath);

  // Use the logo in your PDF generation logic
  doc.image(logoPath, { width: 100, align: 'center' }); // Example usage

  // Add header with sender's information
  console.log("Adding header with sender's information...");
  doc
    .fontSize(10)
    .text('Aek Ads', 50, 120)
    .text('1009/1010, Shreeji Signature', 50, 135)
    .text('Opp. Aashka Hospital,', 50, 150)
    .text('Gandhinagar, India - 382421', 50, 165)
    .text('Phone: 80908 02014', 50, 180)
    .moveDown(2);

  // Proposal details
  const orderValue = parseFloat(proposal.order_value); // Convert string to number
  const gstValue = orderValue * 0.18; // GST = 18%
  const totalValueWithGST = orderValue + gstValue;
  const startDate = new Date(proposal.start_date);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + proposal.end_date);

  const formattedStartDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(startDate);

  const formattedEndDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(endDate);

  const currentDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  // Date and greeting
  console.log("Adding date and greeting...");
  doc
    .fontSize(12)
    .text(`Date: ${currentDate}`, { align: 'right' })
    .moveDown(2)
    .text(`Dear ${proposal.client_name},`)
    .text(
      `We are pleased to present to you the quotation for your proposal. Below are the details of your proposal:`
    )
    .moveDown(1);

  // Proposal details as a letter
  console.log("Adding proposal details...");
  doc
    .fontSize(12)
    .text('Ad Campaign is scheduled to begin on ', { continued: true }) // Regular text
    .font('Helvetica-Bold') // Bold for start date
    .text(`${formattedStartDate}`, { continued: true })
    .font('Helvetica') // Switch back to regular font
    .text(' and will end on ', { continued: true })
    .font('Helvetica-Bold') // Bold for end date
    .text(`${formattedEndDate}`, { continued: true })
    .font('Helvetica') // Switch back to regular font
    .text('. Campaign duration is ', { continued: true })
    .font('Helvetica-Bold') // Bold for end date
    .text(`${proposal.end_date} Days`, { continued: true })
    .font('Helvetica') // Switch back to regular font
    .text('. The order value, excluding GST, is ', { continued: true })
    .font('Helvetica-Bold') // Bold for order value
    .text(`INR ${orderValue.toFixed(2)}`, { continued: true })
    .font('Helvetica') // Switch back to regular font
    .text(', Add GST (18%) amounting to ', { continued: true })
    .font('Helvetica-Bold') // Bold for GST value
    .text(`INR ${gstValue.toFixed(2)}`, { continued: true })
    .font('Helvetica') // Switch back to regular font
    .text('. The total value, inclusive of GST, is ', { continued: true })
    .font('Helvetica-Bold') // Bold for total value
    .text(`INR ${totalValueWithGST.toFixed(2)}.`)
    .font('Helvetica') // End with regular font
    .moveDown(2); // Move down after the entire sentence

  // Cities and reach
  console.log("Adding cities and reach...");
  doc
    .fontSize(12)
    .text('Your selected cities are: ', { continued: true }) // Regular text before bold
    .font('Helvetica-Bold') // Switch to bold font for the cities
    .text(`${proposal.cities}`, { continued: true }) // City names in bold
    .font('Helvetica') // Switch back to regular font
    .text(', offering an impressive total reach of ', { continued: true })
    .font('Helvetica-Bold') // Bold for total reach
    .text(`${proposal.total_approx_reach}`, { continued: true }) // Reach in bold
    .font('Helvetica') // Switch back to regular font
    .text('. With ', { continued: true })
    .font('Helvetica-Bold') // Bold for total properties
    .text(`${proposal.total_properties}`, { continued: true }) // Properties in bold
    .font('Helvetica') // Switch back to regular font
    .text(' properties and ', { continued: true })
    .font('Helvetica-Bold') // Bold for total screens
    .text(`${proposal.total_screens}`, { continued: true }) // Screens in bold
    .font('Helvetica') // Switch back to regular font
    .text(' screens, we ensure maximum visibility and impact.')
    .moveDown(2); // Move to next line after text

  // Add screens and slots details
  console.log("Adding screens and slots details...");
  doc
    .text(
      'Below is a summary of the selected screens and slots for your project:',
      { align: 'left' }
    )
    .moveDown(1)
    .fontSize(14)
    .text('Selected Screens and Slots', { underline: true })
    .moveDown(0.5);

  const tableStartY = doc.y + 10;
  const rowHeight = 20;
  const columnWidths = {
    screenName: 150,
    clientName: 150,
    dateRange: 200,
  };

  doc
    .fontSize(12)
    .text('Screen Name', 50, tableStartY)
    .text('Client Name', 50 + columnWidths.screenName, tableStartY)
    .text('Start Date - End Date', 50 + columnWidths.screenName + columnWidths.clientName, tableStartY)
    .moveDown(1);

  let currentY = tableStartY + rowHeight;
  const maxY = doc.page.height - 50; // Leave margin at the bottom
  const lineHeight = 30; // Height of each line, adjust as necessary
  const seenScreens = new Set(); // Track processed screens

  screens.forEach((screen) => {
    const propertyNames = screen.propertyNames; // Assuming propertyNames is an array

    propertyNames.forEach((slotNumber) => {
      let slotStartDate = screen[`slot${slotNumber}_startdate`];
      let slotEndDate = screen[`slot${slotNumber}_enddate`];
      const slotClientName = screen[`slot${slotNumber}_clientname`];

      if (slotStartDate && slotEndDate) {
        slotStartDate = moment(slotStartDate).format('DD MMM YYYY');
        slotEndDate = moment(slotEndDate).format('DD MMM YYYY');

        console.log(`Processing slot ${slotNumber} for screen: ${screen.screenname}`);

        // Set to track processed screen names
        const processedScreens = new Set();

        if (
          moment(slotStartDate).isValid() &&
          moment(slotEndDate).isValid() &&
          slotClientName === proposal.client_name && // Ensure client names match
          !processedScreens.has(screen.screenname) // Ensure screen name is unique
        ) {
          const screenKey = `${screen.screenname}-${slotNumber}-${slotClientName}`;
          if (!seenScreens.has(screenKey)) {
            seenScreens.add(screenKey); // Mark this screen and slot as processed
            processedScreens.add(screen.screenname); // Mark this screen name as processed

            console.log(`Adding slot: ${slotNumber}, Client: ${slotClientName}, Duration: ${slotStartDate} to ${slotEndDate}`);

            // Check if we need to add a new page
            if (currentY + lineHeight >= maxY) {
              doc.addPage(); // Add a new page if we run out of space
              currentY = 50; // Reset the Y position on the new page
            }

            // Use the text wrapping to prevent overflow and handle multi-line text
            doc
              .text(screen.screenname, 50, currentY, { width: columnWidths.screenName })
              .text(slotClientName, 50 + columnWidths.screenName, currentY, { width: columnWidths.clientName })
              .text(`${formattedStartDate} - ${formattedEndDate}`, 50 + columnWidths.screenName + columnWidths.clientName, currentY, { width: columnWidths.dateRange });

            // Update the Y position based on the line height
            currentY += lineHeight;
          }
        }
      }
    });
  });

  // Terms and conditions
  console.log("Adding terms and conditions...");
  doc
    .addPage()
    .fontSize(14)
    .text('Terms and Conditions', { underline: true })
    .moveDown(0.5)
    .fontSize(12)
    .text(
      `1. This quotation is valid for 30 days from the date of issue.
2. GST is included at the prevailing rate.
3. Payment terms are as per the agreed contract.
4. Screens availability is subject to confirmation at the time of order.`
    );

  // Closing remarks
  console.log("Adding closing remarks...");
  doc
    .fontSize(12)
    .text(
      `We appreciate your business and look forward to delivering exceptional service. Please feel free to reach out to us with any questions.`,
      { align: 'left' }
    );

  // Finalize the PDF
  doc.end();
  console.log("PDF generation complete.");
}


// Example route to generate the quotation PDF



router.get('/generateQuotation', async (req, res) => {
  const proposalID = req.query.proposalID;

  console.log("Received request to generate quotation for Proposal ID:", proposalID);

  try {
      // Fetch proposal details (fetch property_ids and property_names)
      const proposalResult = await pool.query(
        `SELECT id AS proposal_id, client_name, start_date, end_date, order_value, property_ids, property_names, total_approx_reach, cities, total_screens, total_properties 
         FROM public.proposals WHERE id = $1`, [proposalID]
      );

      if (proposalResult.rows.length === 0) {
          throw new Error(`Proposal with ID ${proposalID} not found.`);
      }

      const proposal = proposalResult.rows[0];
      console.log("Fetched proposal details:", proposal);

      // Fetch screen details for the given screenIds
      const screensResult = await pool.query(
        `SELECT screenid, screenname, slot1, slot1_startdate, slot1_enddate, slot1_clientname, slot2, slot2_startdate, slot2_enddate, slot2_clientname, slot3, slot3_startdate, slot3_enddate, slot3_clientname, slot4, slot4_startdate, slot4_enddate, slot4_clientname, slot5, slot5_startdate, slot5_enddate, slot5_clientname, slot6, slot6_startdate, slot6_enddate, slot6_clientname, slot7, slot7_startdate, slot7_enddate, slot7_clientname, slot8, slot8_startdate, slot8_enddate, slot8_clientname, slot9, slot9_startdate, slot9_enddate, slot9_clientname, slot10, slot10_startdate, slot10_enddate, slot10_clientname 
         FROM public.screen_proposal WHERE screenid = ANY($1)`, [proposal.property_ids]
      );

      const screens = screensResult.rows;
      console.log("Fetched screen details for screens:", screens);

      // Now, match the property_names (slots) with corresponding screen slots
      screens.forEach(screen => {
          screen.propertyNames = proposal.property_names;  // Assuming property_names is an array
      });

      // Ensure the "quotations" folder exists, if not, create it
      const quotationsFolderPath = path.join(__dirname, 'quotations');
      if (!fs.existsSync(quotationsFolderPath)) {
          fs.mkdirSync(quotationsFolderPath);
          console.log("Created 'quotations' folder.");
      }

      // Generate the PDF file
      const outputFilePath = path.join(quotationsFolderPath, `quotation_${proposalID}.pdf`);

      console.log("Generating PDF for proposal...");
      generateQuotationPDF(proposal, screens, outputFilePath);

      // Respond to the client with a success message
      res.json({ message: 'Quotation generated successfully.', file: outputFilePath });

  } catch (error) {
      console.error("Error generating quotation:", error);
      res.status(500).json({ error: error.message });
  }
});




















// Prepare the email content
// const emailText = `
// Dear ${proposal.client_name},

// We are pleased to present to you the quotation for your proposal. Below are the details of your proposal:

// The Campaign is scheduled to begin on ${formattedStartDate} and will end on ${formattedEndDate}. The order value, excluding GST, is ₹${orderValue.toFixed(2)}. Add GST (18%) amounting to ₹${gstValue.toFixed(2)}. The total value, inclusive of GST, is ₹${totalValueWithGST.toFixed(2)}.

// Your selected cities are: ${proposal.cities}, offering an impressive total reach of ${proposal.total_approx_reach}. With ${proposal.total_properties} properties and ${proposal.total_screens} screens, we ensure maximum visibility and impact.

// Below is a summary of the selected screens and slots for your project:

// Selected Screens and Slots:
// -------------------------------------
// Screen Name        | Client Name      | Start Date - End Date
// -------------------------------------
// `;

// Add screens and slots details
// screens.forEach((screen) => {
//   const propertyNames = screen.propertyNames; // Assuming propertyNames is an array

//   propertyNames.forEach((slotNumber) => {
//     let slotStartDate = screen[`slot${slotNumber}_startdate`];
//     let slotEndDate = screen[`slot${slotNumber}_enddate`];
//     const slotClientName = screen[`slot${slotNumber}_clientname`];

//     if (slotStartDate && slotEndDate) {
//       slotStartDate = moment(slotStartDate).format('DD MMM YYYY');
//       slotEndDate = moment(slotEndDate).format('DD MMM YYYY');

//       if (
//         moment(slotStartDate).isValid() &&
//         moment(slotEndDate).isValid() &&
//         slotClientName === proposal.client_name
//       ) {
//         emailText += `${screen.screenname}        | ${slotClientName}      | ${formattedStartDate} - ${formattedEndDate}\n`;
//       }
//     }
//   });
// });

// Add Terms and Conditions
// const termsText = `
// Terms and Conditions:
// 1. This quotation is valid for 30 days from the date of issue.
// 2. GST is included at the prevailing rate.
// 3. Payment terms are as per the agreed contract.
// 4. Screens availability is subject to confirmation at the time of order.

// We appreciate your business and look forward to delivering exceptional service. Please feel free to reach out to us with any questions.

// Sincerely,
// Your Name
// Position
// Company Name
// `;

// Combine email body
// const emailBody = emailText + termsText;

// Mail options
// let mailOptions = {
//   from: 'aekads.otp@gmail.com',
//   to: proposal.client_email,
//   subject: `Quotation for Proposal ID: ${proposal.proposal_id}`,
//   text: emailBody, // Use the dynamically created email text
//   attachments: [
//     {
//       filename: `quotation_${proposal.proposal_id}.pdf`,
//       path: outputFilePath, // Path to the generated PDF
//     },
//   ],
// };


// router.get('/sendMail', async (req, res) => {
//   const proposalID = req.query.proposalID;

//   console.log("Received request to generate quotation for Proposal ID:", proposalID);

//   try {
//       // Fetch proposal details (fetch property_ids and property_names)
//       const proposalResult = await pool.query(`SELECT id AS proposal_id, client_name, start_date, end_date, order_value, property_ids, property_names,total_approx_reach,cities,total_screens,total_properties FROM public.proposals WHERE id = $1`, [proposalID]);

//       if (proposalResult.rows.length === 0) {
//           throw new Error(`Proposal with ID ${proposalID} not found.`);
//       }

//       const proposal = proposalResult.rows[0];
//       console.log("Fetched proposal details:", proposal);

//       // Fetch screen details for the given screenIds
//       const screensResult = await pool.query(`SELECT screenid, screenname, slot1, slot1_startdate, slot1_enddate, slot1_clientname, slot2, slot2_startdate, slot2_enddate, slot2_clientname, slot3, slot3_startdate, slot3_enddate, slot3_clientname, slot4, slot4_startdate, slot4_enddate, slot4_clientname, slot5, slot5_startdate, slot5_enddate, slot5_clientname, slot6, slot6_startdate, slot6_enddate, slot6_clientname, slot7, slot7_startdate, slot7_enddate, slot7_clientname, slot8, slot8_startdate, slot8_enddate, slot8_clientname, slot9, slot9_startdate, slot9_enddate, slot9_clientname, slot10, slot10_startdate, slot10_enddate, slot10_clientname FROM public.screen_proposal WHERE screenid = ANY($1)`, [proposal.property_ids]);

//       const screens = screensResult.rows;

//       console.log("Fetched screen details for screens:", screens);

//       // Now, match the property_names (slots) with corresponding screen slots
//       screens.forEach(screen => {
//           screen.propertyNames = proposal.property_names;  // Assuming property_names is an array
//       });

//       // Ensure the "quotations" folder exists, if not, create it
//       const quotationsFolderPath = path.join(__dirname, 'quotations');
//       if (!fs.existsSync(quotationsFolderPath)) {
//           fs.mkdirSync(quotationsFolderPath);
//           console.log("Created 'quotations' folder.");
//       }

//       // Generate the PDF file
//       const outputFilePath = path.join(quotationsFolderPath, `quotation_${proposalID}.pdf`);

//       console.log("Generating PDF for proposal...");
//       sendMail(proposal, screens, outputFilePath);

//       // Respond to the client with a success message
//       res.json({ message: 'Quotation generated successfully.', file: outputFilePath });

//   } catch (error) {
//       console.error("Error generating quotation:", error);
//       res.status(500).json({ error: error.message });
//   }
// });






















// const nodemailer = require('nodemailer');  // Add Nodemailer for sending emails

// async function sendMail(proposal, screens, outputFilePath) {
//   const doc = new PDFDocument({ margin: 50 });

//   // Pipe the output to a file
//   doc.pipe(fs.createWriteStream(outputFilePath));

//   console.log("Generating PDF for Proposal ID:", proposal.proposal_id);

//   // Path to the logo
//   const logoPath = path.join(__dirname, '1.png'); // Adjust this path if necessary

//   // Validate the logo file
//   if (!fs.existsSync(logoPath)) {
//     throw new Error(`Logo file not found at ${logoPath}`);
//   }

//   // Use the logo in your PDF generation logic
//   doc.image(logoPath, { width: 100, align: 'center' }); // Example usage
  
//   // Your existing code for PDF generation...

//   // Finalize the PDF
//   doc.end();
//   console.log("PDF generation complete.");

//   // Now, send the email after the PDF is generated
//   await sendEmail(proposal, outputFilePath);  // Call the function to send the email
// }

// async function sendEmail(proposal, outputFilePath) {
//   // Prepare the email content
//   const startDate = new Date(proposal.start_date);
//   const endDate = new Date(startDate);
//   endDate.setDate(startDate.getDate() + proposal.end_date);

//   const formattedStartDate = new Intl.DateTimeFormat('en-GB', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//   }).format(startDate);

//   const formattedEndDate = new Intl.DateTimeFormat('en-GB', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//   }).format(endDate);

//   const orderValue = parseFloat(proposal.order_value); // Convert string to number
//   const gstValue = orderValue * 0.18; // GST = 18%
//   const totalValueWithGST = orderValue + gstValue;

//   // Prepare the email body
//   let emailText = `
//     Dear ${proposal.client_name},
    
//     We are pleased to present to you the quotation for your proposal. Below are the details of your proposal:

//     The Campaign is scheduled to begin on ${formattedStartDate} and will end on ${formattedEndDate}. The order value, excluding GST, is ₹${orderValue.toFixed(2)}. Add GST (18%) amounting to ₹${gstValue.toFixed(2)}. The total value, inclusive of GST, is ₹${totalValueWithGST.toFixed(2)}.

//     Your selected cities are: ${proposal.cities}, offering an impressive total reach of ${proposal.total_approx_reach}. With ${proposal.total_properties} properties and ${proposal.total_screens} screens, we ensure maximum visibility and impact.

//     Below is a summary of the selected screens and slots for your project:

//     Selected Screens and Slots:
//     -------------------------------------
//     Screen Name        | Client Name      | Start Date - End Date
//     -------------------------------------
//   `;

//   screens.forEach((screen) => {
//     const propertyNames = screen.propertyNames; // Assuming propertyNames is an array

//     propertyNames.forEach((slotNumber) => {
//       let slotStartDate = screen[`slot${slotNumber}_startdate`];
//       let slotEndDate = screen[`slot${slotNumber}_enddate`];
//       const slotClientName = screen[`slot${slotNumber}_clientname`];

//       if (slotStartDate && slotEndDate) {
//         slotStartDate = moment(slotStartDate).format('DD MMM YYYY');
//         slotEndDate = moment(slotEndDate).format('DD MMM YYYY');

//         if (
//           moment(slotStartDate).isValid() &&
//           moment(slotEndDate).isValid() &&
//           slotClientName === proposal.client_name
//         ) {
//           emailText += `${screen.screenname}        | ${slotClientName}      | ${formattedStartDate} - ${formattedEndDate}\n`;
//         }
//       }
//     });
//   });

//   // Add Terms and Conditions
//   const termsText = `
//   Terms and Conditions:
//   1. This quotation is valid for 30 days from the date of issue.
//   2. GST is included at the prevailing rate.
//   3. Payment terms are as per the agreed contract.
//   4. Screens availability is subject to confirmation at the time of order.

//   We appreciate your business and look forward to delivering exceptional service. Please feel free to reach out to us with any questions.

//   Sincerely,
//   Your Name
//   Position
//   Company Name
//   `;

//   // Combine email body
//   const emailBody = emailText + termsText;

//   // Create a transporter for sending emails
//   const transporter = nodemailer.createTransport({
//     service: 'gmail', // You can change this to another provider
//     auth: {
//       user: 'aekads.otp@gmail.com',  // Your email address
//       pass: 'ntkp cloo wjnx atep',   // Your email password or App password
//     },
//   });

//   // Mail options
//   const mailOptions = {
//     from: 'aekads.otp@gmail.com',
//     to: proposal.client_email,
//     subject: `Quotation for Proposal ID: ${proposal.proposal_id}`,
//     text: emailBody,  // Use the dynamically created email text
//     attachments: [
//       {
//         filename: `quotation_${proposal.proposal_id}.pdf`,
//         path: outputFilePath, // Path to the generated PDF
//       },
//     ],
//   };

//   // Send the email
//   try {
//     await transporter.sendMail(mailOptions);
//     console.log('Email sent successfully.');
//   } catch (error) {
//     console.error('Error sending email:', error);
//     throw new Error('Error sending email');
//   }
// }

// // Route handler (assuming the rest of the code is in place)
// router.get('/sendMail', async (req, res) => {
//   const proposalID = req.query.proposalID;

//   console.log("Received request to generate quotation for Proposal ID:", proposalID);

//   try {
//     // Fetch proposal details (fetch property_ids and property_names)
//     const proposalResult = await pool.query(`SELECT id AS proposal_id, client_name, start_date, end_date, order_value, property_ids, property_names,total_approx_reach,cities,total_screens,total_properties, client_email FROM public.proposals WHERE id = $1`, [proposalID]);

//     if (proposalResult.rows.length === 0) {
//       throw new Error(`Proposal with ID ${proposalID} not found.`);
//     }

//     const proposal = proposalResult.rows[0];
//     console.log("Fetched proposal details:", proposal);

//     // Fetch screen details for the given screenIds
//     const screensResult = await pool.query(`SELECT screenid, screenname, slot1, slot1_startdate, slot1_enddate, slot1_clientname, slot2, slot2_startdate, slot2_enddate, slot2_clientname, slot3, slot3_startdate, slot3_enddate, slot3_clientname, slot4, slot4_startdate, slot4_enddate, slot4_clientname, slot5, slot5_startdate, slot5_enddate, slot5_clientname, slot6, slot6_startdate, slot6_enddate, slot6_clientname, slot7, slot7_startdate, slot7_enddate, slot7_clientname, slot8, slot8_startdate, slot8_enddate, slot8_clientname, slot9, slot9_startdate, slot9_enddate, slot9_clientname, slot10, slot10_startdate, slot10_enddate, slot10_clientname FROM public.screen_proposal WHERE screenid = ANY($1)`, [proposal.property_ids]);

//     const screens = screensResult.rows;

//     console.log("Fetched screen details for screens:", screens);

//     // Now, match the property_names (slots) with corresponding screen slots
//     screens.forEach(screen => {
//       screen.propertyNames = proposal.property_names;  // Assuming property_names is an array
//     });

//     // Ensure the "quotations" folder exists, if not, create it
//     const quotationsFolderPath = path.join(__dirname, 'quotations');
//     if (!fs.existsSync(quotationsFolderPath)) {
//       fs.mkdirSync(quotationsFolderPath);
//       console.log("Created 'quotations' folder.");
//     }

//     // Generate the PDF file
//     const outputFilePath = path.join(quotationsFolderPath, `quotation_${proposalID}.pdf`);

//     console.log("Generating PDF for proposal...");
//     await sendMail(proposal, screens, outputFilePath);  // Generate PDF and send the email

//     // Respond to the client with a success message
//     res.json({ message: 'Quotation generated and email sent successfully.', file: outputFilePath });

//   } catch (error) {
//     console.error("Error generating quotation or sending email:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

const nodemailer = require('nodemailer');  // Add Nodemailer for sending emails



async function sendEmail(proposal, screens) {
  // Prepare the email content
  const startDate = new Date(proposal.start_date);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + proposal.end_date);

  const formattedStartDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(startDate);

  const formattedEndDate = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(endDate);

  const orderValue = parseFloat(proposal.order_value); // Convert string to number
  const gstValue = orderValue * 0.18; // GST = 18%
  const totalValueWithGST = orderValue + gstValue;

  // Prepare the email body in HTML format
 // Prepare the email body in HTML format
let emailText = `
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
        color: #333;
      }
      .container {
        width: 80%;
        margin: 0 auto;
        background-color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      h2 {
        color: #2c3e50;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
      }
      table, th, td {
        border: 1px solid #ddd;
      }
      th, td {
        padding: 10px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
      }
      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: #777;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Quotation for Proposal </h2>
      <p>Dear <strong>${proposal.client_name}</strong>,</p>
      <p>We are pleased to present to you the quotation for your proposal. Below are the details of your proposal:</p>
      <p><strong>Ad Campaign</strong> is scheduled to begin on<strong> ${formattedStartDate}</strong> and will end on <strong>${formattedEndDate}</strong>. Campaign duration is <strong>${proposal.end_date} Days</strong>. The order value, excluding GST, is <strong>₹${orderValue.toFixed(2)}</strong>. Add GST (18%) amounting to <strong>₹${gstValue.toFixed(2)}</strong>. The total value, inclusive of GST, is <strong>₹${totalValueWithGST.toFixed(2)}</strong>.</p>

      <p>Your selected cities are: <strong>${proposal.cities}</strong>, offering an impressive total reach of <strong>${proposal.total_approx_reach}</strong>. With <strong>${proposal.total_properties}</strong> properties and <strong>${proposal.total_screens}</strong> screens, we ensure maximum visibility and impact.</p>

      <p><strong>Selected Screens:</strong></p>
      <table>
        <tr>
          <th>Screen Name</th>
          <th>Client Name</th>
          <th>Start Date - End Date</th>
        </tr>
`;

const processedScreens = new Set(); // Set to track processed screen names

screens.forEach((screen) => {
const propertyNames = screen.propertyNames; // Assuming propertyNames is an array

propertyNames.forEach((slotNumber) => {
  let slotStartDate = screen[`slot${slotNumber}_startdate`];
  let slotEndDate = screen[`slot${slotNumber}_enddate`];
  const slotClientName = screen[`slot${slotNumber}_clientname`];

  if (slotStartDate && slotEndDate) {
    slotStartDate = moment(slotStartDate).format('DD MMM YYYY');
    slotEndDate = moment(slotEndDate).format('DD MMM YYYY');

    if (
      moment(slotStartDate).isValid() &&
      moment(slotEndDate).isValid() &&
      slotClientName === proposal.client_name && // Ensure client names match
      !processedScreens.has(screen.screenname) // Ensure screen name is unique
    ) {
      // Mark the screen as processed
      processedScreens.add(screen.screenname);

      // Add screen and slot details to email text
      emailText += `
        <tr>
          <td>${screen.screenname}</td>
          <td>${slotClientName}</td>
          <td>${formattedStartDate} - ${formattedEndDate}</td>
        </tr>
      `;
    }
  }
});
});

// Add Terms and Conditions
emailText += `
      </table>
      <div class="footer">
        <p><strong>Terms and Conditions:</strong></p>
        <ul>
          <li>This quotation is valid for 30 days from the date of issue.</li>
          <li>GST is included at the prevailing rate.</li>
          <li>Payment terms are as per the agreed contract.</li>
          <li>Screens availability is subject to confirmation at the time of order.</li>
        </ul>
        <p>We appreciate your business and look forward to delivering exceptional service. Please feel free to reach out to us with any questions.</p>
        
      </div>
    </div>
  </body>
</html>
`;

// Combine email body
const emailBody = emailText;

  

  // Create a transporter for sending emails
  const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another provider
    auth: {
      user: 'aekads.otp@gmail.com',  // Your email address
      pass: 'ntkp cloo wjnx atep',   // Your email password or App password
    },
  });

  // Mail options
  const mailOptions = {
    from: 'aekads.otp@gmail.com',
    to: proposal.poc_email,
    subject: `Quotation for ${proposal.client_name}`,
    html: emailBody,  // Use the dynamically created email HTML
  };

  // Send the email
  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully.');
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Error sending email');
  }
}


// Route handler (assuming the rest of the code is in place)
router.get('/sendMail', async (req, res) => {
  const proposalID = req.query.proposalID;

  console.log("Received request to generate quotation for Proposal ID:", proposalID);

  try {
    // Fetch proposal details (fetch property_ids and property_names)
    const proposalResult = await pool.query(`SELECT id AS proposal_id,poc_email, client_name, start_date, end_date, order_value, property_ids, property_names,total_approx_reach,cities,total_screens,total_properties FROM public.proposals WHERE id = $1`, [proposalID]);

    if (proposalResult.rows.length === 0) {
      throw new Error(`Proposal with ID ${proposalID} not found.`);
    }

    const proposal = proposalResult.rows[0];
    console.log("Fetched proposal details:", proposal);

    // Fetch screen details for the given screenIds
    const screensResult = await pool.query(`SELECT screenid, screenname, slot1, slot1_startdate, slot1_enddate, slot1_clientname, slot2, slot2_startdate, slot2_enddate, slot2_clientname, slot3, slot3_startdate, slot3_enddate, slot3_clientname, slot4, slot4_startdate, slot4_enddate, slot4_clientname, slot5, slot5_startdate, slot5_enddate, slot5_clientname, slot6, slot6_startdate, slot6_enddate, slot6_clientname, slot7, slot7_startdate, slot7_enddate, slot7_clientname, slot8, slot8_startdate, slot8_enddate, slot8_clientname, slot9, slot9_startdate, slot9_enddate, slot9_clientname, slot10, slot10_startdate, slot10_enddate, slot10_clientname FROM public.screen_proposal WHERE screenid = ANY($1)`, [proposal.property_ids]);

    const screens = screensResult.rows;

    console.log("Fetched screen details for screens:", screens);

    // Now, match the property_names (slots) with corresponding screen slots
    screens.forEach(screen => {
      screen.propertyNames = proposal.property_names;  // Assuming property_names is an array
    });

    // Send the email
    await sendEmail(proposal, screens);  // Send email without generating PDF

    // Respond to the client with a success message
    res.json({ message: 'Email sent successfully.' });

  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message });
  }
});




module.exports = router;
