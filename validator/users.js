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

  email: joi
    .string().
    trim().
    email()
    .required(),

  phone: joi
    .number()
    .min(11)
    .required()
    .messages({
    "number.base": "Phone number must be a valid number",
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

export default { loginSchema, registerSchema };
