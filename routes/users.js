import express from "express";
import controller from "../controllers/users.js";
import middleware from "../middlewares/index.js";
import upload from "../middlewares/upload.js";

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

router.get("/me", middleware.checkAuth, controller.getMe);
router.get(
  "/profile-image",
  middleware.checkAuth,
  controller.getMyProfileImage
);

router.get(
  "/profile-image/:id",
  controller.getProfileImage
);
router.get(
  "/",
  middleware.checkAuth,
  middleware.checkRole("ADMIN", "RECEPTIONIST"),
  controller.getAllUsers,
);
router.get(
  "/contactable-employees",
  middleware.checkAuth,
  controller.getContactableEmployees,
);
router.get(
  "/:id",
  middleware.checkAuth,
  middleware.checkObjectId,
  middleware.checkRole("RECEPTIONIST"),
  controller.getOneUser,
);

router.post("/register", controller.registerUser);
console.log("Registering email verification route");
// Email verification
router.post(
  "/email-verification/verify",
  controller.verifyEmail,
);
console.log(
  "Resend controller:",
  typeof controller.resendEmailVerification,
);

router.post(
  "/email-verification/resend",
  controller.resendEmailVerification,
);
// -----------------------------------------
router.post("/", middleware.checkAdmin, controller.createUser);

router.post(
  "/profile-image",
  middleware.checkAuth,
  upload.single("profileImage"),
  controller.uploadProfileImage,
);

router.post("/login", controller.loginUser);
router.patch(
  "/update/:id",
  middleware.checkAdmin,
  middleware.checkObjectId,
  controller.updateUser,
);
router.patch(
  "/profile",
  middleware.checkAuth,
  controller.updateOwnProfile,
);
router.patch(
  "/address",
  middleware.checkAuth,
  controller.updateOwnAddress,
);
router.put(
  "/update/:id",
  middleware.checkAdmin,
  middleware.checkObjectId,
  controller.updateUserDocument,
);
router.post("/logout", controller.logoutUser);
router.delete(
  "/delete/:id",
  middleware.checkAdmin,
  middleware.checkObjectId,
  controller.removeUser,
);

// OTP
router.post("/otp/request", controller.requestOtp);
router.post("/otp/retry", controller.retryOtp);
router.post("/otp/verify", controller.verifyOtp);
router.delete("/delete/", (req, res) => {
  return res.status(400).json({
    message: "User id is required",
  });
});
export default router;
