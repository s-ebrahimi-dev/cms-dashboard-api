import joi from "joi";

const loginSchema = joi.object({
  identifier: joi.string().trim().min(3).max(100).required(),
  password: joi.string().min(6).max(100).required(),
});

const registerSchema = joi.object({
  firstname: joi.string().trim().min(2).max(30).required(),

  lastname: joi.string().trim().min(2).max(30).required(),

  username: joi
    .string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Username can only contain letters, numbers, and underscores",
    }),

  email: joi.string().trim().email().required(),

  phone: joi
    .string()
    .trim()
    .pattern(/^[0-9]{11}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 11 digits",
    }),
  password: joi
    .string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    }),

  confirmPassword: joi.any().valid(joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),
});

const createUserSchema = joi.object({
  firstname: joi.string().trim().min(2).max(30).required(),

  lastname: joi.string().trim().min(2).max(30).required(),

  username: joi
    .string()
    .trim()
    .min(3)
    .max(30)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Username can only contain letters, numbers, and underscores",
    }),

  email: joi.string().trim().email().required(),

  phone: joi
    .string()
    .trim()
    .pattern(/^[0-9]{11}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be exactly 11 digits",
    }),

  password: joi
    .string()
    .min(8)
    .max(100)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
    .required()
    .messages({
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
    }),

  confirmPassword: joi.any().valid(joi.ref("password")).required().messages({
    "any.only": "Passwords do not match",
    "any.required": "Confirm password is required",
  }),

  role: joi
    .string()
    .valid(
      "ADMIN",
      "CUSTOMER",
      "RECEPTIONIST",
      "MECHANIC",
      "OIL_TECHNICIAN",
      "BODY_REPAIR",
      "DETAILING_TECHNICIAN",
      "WASH_TECHNICIAN",
    )
    .required(),

  maxConcurrentVehicles: joi.when("role", {
    is: joi.valid(
      "MECHANIC",
      "OIL_TECHNICIAN",
      "BODY_REPAIR",
      "DETAILING_TECHNICIAN",
      "WASH_TECHNICIAN",
    ),
    then: joi.number().integer().min(1).default(1),
    otherwise: joi.forbidden(),
  }),
});

const updateOwnAddressSchema = joi.object({
  address: joi.object({
    country: joi.string().trim().max(100).required(),
    province: joi.string().trim().max(100).allow(""),
    city: joi.string().trim().max(100).required(),
    district: joi.string().trim().max(100).allow(""),
    street: joi.string().trim().max(150).allow(""),
    buildingNumber: joi.string().trim().max(30).allow(""),
    unit: joi.string().trim().max(30).allow(""),
    postalCode: joi.string().trim().max(30).allow(""),

    location: joi.object({
      type: joi.string().valid("Point").required(),

      coordinates: joi
        .array()
        .items(
          joi.number().min(-180).max(180).required(),
          joi.number().min(-90).max(90).required(),
        )
        .length(2)
        .required(),
    }).required(),
  }).required(),
});

export default { loginSchema, registerSchema, createUserSchema, updateOwnAddressSchema };
