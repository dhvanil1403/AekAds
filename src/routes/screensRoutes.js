// const express = require("express");
// const router = express.Router();
// const screen = require("../controllers/newScreen.controller");
// const groupRouter = require("./groupsRoutes");

// router.route("/alldata").get(screen.getAllScreensAllData);
// // GET all not deleted screens
// router.route("/").get(screen.getAllScreens).post(screen.addScreen);

// // Group screen route
// // router.get("/GroupScreen", screen.showGroupScreen);

// // Use groupRouter for '/Groups' path
// router.use("/Groups", groupRouter);


// // PUT request to mark a screen's playlist as deleted (set playlistname to null)
// router.put("/:screenid/deletePlaylist", screen.deletePlaylist);

// // POST request to mark a screen as deleted
// router
//   .route("/mark-as-deleted")
//   .post(screen.updateDeleteScreen)  
 
// router
//   .route("/restore")  
//   .post(screen.restoreScreen)
//   .get(screen.getAllScreens)

// // GET all deleted screens
// // router.get('/Deleted-Screen', screen.getDeletedScreens);

// // GET screen details by pairing code
// router.get("/:pairingCode", screen.screenByPairingCode);

// // Routes for editing screen
// router
//   .route("/edit-screen")
//   .post(screen.editScreen)
  

// module.exports = router;


const express = require("express");
  const router = express.Router();
  const screen = require("../controllers/newScreen.controller");
  const groupRouter = require("./groupsRoutes");
  const db = require("../config/dbConnection");
  router.route("/alldata").get(screen.getAllScreensAllData);
  // GET all not deleted screens
  router.route("/").get(screen.getAllScreens).post(screen.addScreen);

  // Group screen route
  // router.get("/GroupScreen", screen.showGroupScreen);

  // Use groupRouter for '/Groups' path
  router.use("/Groups", groupRouter);


  // PUT request to mark a screen's playlist as deleted (set playlistname to null)
  router.put("/:screenid/deletePlaylist", screen.deletePlaylist);

  // POST request to mark a screen as deleted
  router
    .route("/mark-as-deleted")
    .post(screen.updateDeleteScreen)  
  
  router
    .route("/restore")  
    .post(screen.restoreScreenInDB)
    .get(screen.getAllScreens)

  // GET all deleted screens
  // router.get('/Deleted-Screen', screen.getDeletedScreens);

  // GET screen details by pairing code
  router.get("/:pairingCode", screen.screenByPairingCode);

  // Routes for editing screen
  router
    .route("/edit-screen")
    .post(screen.editScreen)
    
    router.delete('/delete-screen/:screenid', screen.deleteScreen);



    router.get('/preview/:screenId', async (req, res) => {
      const { screenId } = req.params;
      try {
        const result = await db.query('SELECT * FROM screens WHERE screenid = $1', [screenId]);
        if (result.rows.length > 0) {
          res.json(result.rows[0]); // Assuming your slots are stored in one row
        } else {
          res.status(404).send('Screen not found');
        }
      } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
      }
    });
  module.exports=router;
