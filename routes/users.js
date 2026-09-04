import express from "express";
import controller from "../controllers/users.js";
import middleware from "../middlewares/index.js";
const router = express.Router();

router.use((req, res, next) => {
  console.log("==============New request for users route==================");
  console.log("Time:", new Date().toLocaleString());
  console.log("Method:", req.method);
  console.log("Url:", req.originalUrl);
  console.log("Ip:", req.ip);
  console.log("User-Agent:", req["user-agent"]);
  console.log("Params:", req.params);
  console.log("==============End of request==================");

  next();
});

router.get("/", controller.getAllUsers);
router.get("/:id", middleware.checkAdmin, middleware.checkObjectId, controller.getOneUser);

router.post("/register", controller.registerUser);

router.post("/login", controller.loginUser);
router.patch("/update/:id",middleware.checkAdmin, middleware.checkObjectId, controller.updateUser)
router.put("/update/:id", middleware.checkAdmin, middleware.checkObjectId, controller.updateUserDocument)
router.delete("/delete/:id",middleware.checkAdmin, middleware.checkObjectId, controller.removeUser);
router.delete("/delete/", (req, res) => {
    return res.status(400).json({
        message: "User id is required"
    });
});
export default router;
