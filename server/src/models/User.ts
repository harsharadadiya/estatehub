import bcrypt from 'bcryptjs';
import mongoose, { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password: string;
  passwordChangedAt?: Date;
  /** Goes up by 1 on every password change. Login tokens carry it, so old tokens stop working. */
  tokenVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IUserMethods {
  comparePassword(plain: string): Promise<boolean>;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
type UserModel = Model<IUser, object, IUserMethods>;

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, default: '' },
    // select: false -> never returned by queries unless asked for with .select('+password')
    password: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date, select: false },
    tokenVersion: { type: Number, default: 0, select: false },
    passwordResetTokenHash: { type: String, select: false, index: { sparse: true } },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Hash the password whenever it is new or changed (bcrypt, cost 12)
userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
    this.tokenVersion = (this.tokenVersion ?? 0) + 1; // logs out every other device
  }
});

userSchema.methods.comparePassword = function comparePassword(plain: string) {
  return bcrypt.compare(plain, this.password);
};

// Never send secrets to the browser
userSchema.set('toJSON', {
  versionKey: false,
  transform(_doc, ret) {
    delete (ret as Partial<typeof ret>).password;
    delete (ret as Partial<typeof ret>).passwordChangedAt;
    delete (ret as Partial<typeof ret>).tokenVersion;
    delete (ret as Partial<typeof ret>).passwordResetTokenHash;
    delete (ret as Partial<typeof ret>).passwordResetExpires;
    return ret;
  },
});

export const User = mongoose.model<IUser, UserModel>('User', userSchema);
