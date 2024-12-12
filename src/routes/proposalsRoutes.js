const express = require('express');
const pool = require('../config/dbConnection');
const router = express.Router();

router.get('/', async (req, res) => {
    // This route is only accessible to superadmins

    try {

         // Query to select all proposals with status 'pending'
      const result = await pool.query(
        "SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC",
        ['pending']
    );
      // Query to select all proposals with status 'Pending Activation'
      const selectResult = await pool.query(
          "SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC",
          ['Waiting for Admin Approval']
      );

      // Query to select all proposals with status 'Discarded'
      const discardProposal = await pool.query(
          "SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC",
          ['Discarded']
      );

      // Query to select proposals with status 'Waiting for Admin Approval' or 'Active'
      const waitingOrActiveProposals = await pool.query(
          "SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC",
          ['Active']
      );

      const editeedActiveProposal = await pool.query(
        "SELECT * FROM proposals WHERE status = $1 ORDER BY id DESC",
        ['Edited Active Proposal']
    );

    const screenProposal = await pool.query('select screenid,screenname from screen_proposal order by screenid desc');
      // Ensure all arrays are defined, even if empty
      const waitingForAdminApproveProposals = selectResult.rows || [];
      const discardProposals = discardProposal.rows || [];
      const activeProposals = waitingOrActiveProposals.rows || [];
      const editeedActiveProposals = editeedActiveProposal.rows || [];

      // Render the 'createProposal' view, passing all the proposal categories
      res.render("Proposals", { 
        proposals: result.rows, 
        waitingForAdminApproveProposals, 
        discardProposals, 
        activeProposals,
        editeedActiveProposals,
        screenProposal: screenProposal.rows || [],
      });
      
  } catch (error) {
      console.error("Error retrieving proposal data:", error);
      res.status(500).json({ success: false, error: "Database error" });
  }
});

// router.post('/AdminAproval', async (req, res) => {
//   const { proposalId } = req.body;

//   try {
//       const updateResult = await pool.query(
//           'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
//           ['Active', proposalId] // New status is set here
//       ); 

//       if (updateResult.rows.length === 0) {
//           return res.status(404).json({ message: 'Proposal not found' });
//       }

//       // Return the updated proposal as JSON
//       res.json({ message: 'Proposal Aproved successfully', updatedProposal: updateResult.rows[0] });
//   } catch (error) {
//       console.error(error);
//       res.status(500).json({ message: 'Error updating proposal' });
//   }
// });



router.post('/AdminAproval', async (req, res) => {
    const { proposalId } = req.body;
    console.log('Received proposalId:', proposalId);
  
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
            proposalData.url4
        ].filter(Boolean); // Filters out null/undefined URLs
        console.log('Merged URLs:', mergedUrls);
  
        // Step 3: Get propertiesIds and propertiesNames
        const propertiesIds = proposalData.property_ids;
        const propertiesNames = proposalData.property_names;
        console.log('Properties IDs:', propertiesIds);
        console.log('Properties Names:', propertiesNames);
  
        // Step 4: Search in screens table for matching screenIds
        const screensResult = await pool.query(
            'SELECT * FROM screens WHERE screenid = ANY($1)',
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
                    // console.log(`Processing screen with screenid ${screen.screenid}, filling ${slotField} with merged URLs:`, mergedUrls);
  
                    // Update the specified slot in the screen
                    await pool.query(
                        `UPDATE screens SET ${slotField} = $1 WHERE screenid = $2`,
                        [JSON.stringify(mergedUrls), screen.screenid]
                    );
  
                    console.log(`Updated screenid ${screen.screenid} with merged URLs in ${slotField}`);
                }
            }
        }
  
        // Step 6: Update the proposal status to 'Active'
        const updateResult = await pool.query(
            'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
            ['Active', proposalId]
        );
        console.log('Proposal status updated to Active:', updateResult.rows[0]);
  
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
  













  
  router.post('/DeactiveProposal', async (req, res) => {
    const { proposalId } = req.body;
    console.log('Received deactive proposalId:', proposalId);

    try {
        // Step 1: Fetch proposal data by proposalId
        const proposalResult = await pool.query(
            'SELECT * FROM proposals WHERE id = $1',
            [proposalId]
        );
        console.log('Proposal data result:', proposalResult.rows);

        // Check if the proposal was found
        if (proposalResult.rows.length === 0) {
            console.log('Proposal not found');
            return res.status(404).json({ message: 'Proposal not found' });
        }

        const proposalData = proposalResult.rows[0];
        const propertiesIds = proposalData.property_ids;
        const propertiesNames = proposalData.property_names;
        console.log('Properties IDs:', propertiesIds);
        console.log('Properties Names:', propertiesNames);

        // Step 2: Fetch matching screens from the screens table
        const screensResult = await pool.query(
            'SELECT * FROM screens WHERE screenid = ANY($1)',
            [propertiesIds]
        );
        console.log('Number of screens matching propertiesIds:', screensResult.rows.length);

        // Step 3: Update slots in screens table based on property names
        for (const screen of screensResult.rows) {
            const screenIndex = propertiesIds.indexOf(screen.screenid.toString());

            if (screenIndex !== -1) {
                const slotNumber = propertiesNames[screenIndex];
                if (slotNumber) {
                    const slotField = `slot${slotNumber}`;

                    // Set the slot field to null
                    await pool.query(
                        `UPDATE screens SET ${slotField} = $1 WHERE screenid = $2`,
                        [null, screen.screenid]
                    );
                    console.log(`Updated ${slotField} to null for screenid: ${screen.screenid}`);
                }
            }
        }

        // Step 4: Fetch matching records from screen_proposal table
        const screensProposalResult = await pool.query(
            'SELECT * FROM screen_proposal WHERE screenid = ANY($1)',
            [propertiesIds]
        );
        console.log('Number of records in screen_proposal matching propertiesIds:', screensProposalResult.rows.length);

        // Step 5: Update slots in screen_proposal table
        for (const screen of screensProposalResult.rows) {
            const screenIndex = propertiesIds.indexOf(screen.screenid.toString());

            if (screenIndex !== -1) {
                const slotNumber = propertiesNames[screenIndex];
                if (slotNumber) {
                    const slotField = `slot${slotNumber}`;
                    const slotStartDateField = `slot${slotNumber}_startDate`;
                    const slotEndDateField = `slot${slotNumber}_endDate`;
                    const slotClientNameField = `slot${slotNumber}_clientname`;

                    // Set the slot fields to null
                    await pool.query(
                        `UPDATE screen_proposal 
                         SET ${slotField} = $1,
                             ${slotStartDateField} = $2,
                             ${slotEndDateField} = $3,
                             ${slotClientNameField} = $4
                         WHERE screenid = $5`,
                        [null, null, null, null, screen.screenid]
                    );
                    console.log(`Cleared fields for slot ${slotNumber} in screen_proposal for screenid: ${screen.screenid}`);
                }
            }
        }

        // Step 6: Update the proposal status to 'Discarded'
        const updateResult = await pool.query(
            'UPDATE proposals SET status = $1 WHERE id = $2 RETURNING *',
            ['Discarded', proposalId]
        );
        console.log('Proposal status updated to Discarded:', updateResult.rows[0]);

        // Prepare the response data
        const response = {
            message: 'Proposal deactivated successfully',
            discardedProposal: updateResult.rows[0],
            propertiesIds,
            propertiesNames,
            updatedScreens: screensResult.rows,
        };

        // Send the response
        res.json(response);

    } catch (error) {
        console.error('Error during update:', error);
        res.status(500).json({ message: 'Error updating proposal' });
    }
});


router.post('/ExtendProposal', async (req, res) => {
    const { proposalId, newEndDate } = req.body;

    if (!proposalId || !newEndDate) {
        return res.status(400).json({ message: 'Proposal ID and New End Date are required.' });
    }

    try {
        const result = await pool.query(
            'UPDATE proposals SET end_date = end_date + $1 WHERE id = $2 RETURNING *',
            [newEndDate, proposalId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Proposal not found.' });
        }

        res.json({ message: 'Proposal extended successfully.', updatedProposal: result.rows[0] });
    } catch (error) {
        console.error('Error extending proposal:', error.message);
        res.status(500).json({ message: 'Internal server error.' });
    }
});





router.get('/allData', async (req, res) =>{
    try {
        const allscreenProposalData = await pool.query('select * from screen_proposal order by screenid desc');
        res.json(allscreenProposalData.rows)
    } catch (error) {
        console.error('Error fetching screen_proposal data:', error.message);
        res.status(500).json({ message: 'Unable to retrieve data from screen_proposal' });
    }
})
module.exports = router;