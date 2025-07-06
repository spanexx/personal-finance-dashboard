# Mongoose Models Guidelines

## Purpose

This `Gemini.md` provides specific guidelines for creating and managing
Mongoose schemas and models within this directory. Models define the structure
of data stored in MongoDB and provide an interface for database operations.

## Industry Standards & Best Practices

- **Schema Definition:** Each model must have a clear and well-defined
  Mongoose schema. Schemas should reflect the data structure accurately.
- **Validation:** Implement schema-level validation for all fields (e.g.,
  `required`, `minlength`, `maxlength`, `enum`, custom validators). This ensures
  data integrity at the database level.
- **Timestamps:** Always include `timestamps: true` in schema options. This
  automatically adds `createdAt` and `updatedAt` fields, which are crucial for
  auditing and data management.
- **Virtuals:** Use virtual properties for derived data that does not need to
  be persisted in the database (e.g., `fullName` from `firstName` and
  `lastName`).
- **Methods and Statics:** Add instance methods (`schema.methods`) for
  operations on a single document and static methods (`schema.statics`) for
  operations on the model itself (e.g., custom finders).
- **Referencing:** When establishing relationships between collections, use
  `ObjectId` and the `ref` property for referencing. Avoid deep nesting unless
  absolutely necessary and justified.
- **Pre/Post Hooks (Middleware):** Use Mongoose pre and post hooks sparingly
  and only for cross-cutting concerns like password hashing before saving, or
  logging after deletion. Avoid complex business logic within hooks.
- **Indexing:** Define indexes on fields that are frequently queried to
  improve database read performance. Consider compound indexes for multi-field
  queries.

### Relevant Industry Resources:

- **Mongoose Schemas:** [https://mongoosejs.com/docs/guide.html]
  (https://mongoosejs.com/docs/guide.html)
- **Mongoose Validation:** [https://mongoosejs.com/docs/validation.html]
  (https://mongoosejs.com/docs/validation.html)
- **MongoDB Data Modeling:** [https://www.mongodb.com/docs/manual/core/data
  modeling-introduction/](https://www.mongodb.com/docs/manual/core/data-modeling
  introduction/)
- **Mongoose Population:** [https://mongoosejs.com/docs/populate.html]
  (https://mongoosejs.com/docs/populate.html)

### Example Model Structure:

```typescript
import { Schema, model, Document } from 'mongoose';
// Define an interface for the document to ensure type safety
interface IProduct extends Document {
 name: string;
 description: string;
 price: number;
 category: Schema.Types.ObjectId; // Reference to Category model
 stock: number;
 isActive: boolean;
 createdAt: Date;
 updatedAt: Date;
}
const ProductSchema = new Schema<IProduct>({
name: { type: String, required: true, trim: true, minlength: 3, maxlength:
100 },
description: { type: String, trim: true, maxlength: 500 },
price: { type: Number, required: true, min: 0 },
category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
stock: { type: Number, required: true, min: 0, default: 0 },
isActive: { type: Boolean, default: true },
}, { timestamps: true });
// Add an index for frequently queried fields
ProductSchema.index({ category: 1, name: 1 });
// Example: Add a static method to find active products
ProductSchema.statics.findActiveProducts = function() {
return this.find({ isActive: true });
};
export const Product = model<IProduct>('Product', ProductSchema);
import { Schema, model, Document } from 'mongoose';
interface ICategory extends Document {
name: string;
description: string;
createdAt: Date;
updatedAt: Date;
}
const CategorySchema = new Schema<ICategory>({
name: { type: String, required: true, unique: true, trim: true },
description: { type: String, trim: true, maxlength: 200 },
}, { timestamps: true });
export const Category = model<ICategory>('Category', CategorySchema);
Task List Management
When working on a model-related task, I expect you to maintain a task list within our
conversation. Update the status of each item as you progress.
Task Status Definitions:
[ ] Pending: Task not yet started.
[x] Complete : Task successfully finished.
[>] In Progress : Task currently being worked on.
[!] Blocked : Task cannot proceed due to an external dependency or issue.
Example Task List Usage:
When I give you a task like "Create a
Product model with fields for name, description,
price, category, and stock," your response should include a task list like this:
**Task List for Product Model Creation:**- [ ] Pending: Define `IProduct` interface- [>] In Progress: Create `ProductSchema` with validation- [ ] Pending: Add `timestamps` option- [ ] Pending: Export `Product` model
And then you would update it in subsequent interactions:
**Task List for Product Model Creation:**- [x] Complete: Define `IProduct` interface- [>] In Progress: Create `ProductSchema` with validation (currently adding
category reference)- [ ] Pending: Add `timestamps` option- [ ] Pending: Export `Product` model
```
