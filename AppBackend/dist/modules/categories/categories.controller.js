"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const categories_service_1 = require("./categories.service");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const express_2 = __importDefault(require("express"));
const router = (0, express_1.Router)();
const categoriesService = new categories_service_1.CategoriesService();
router.use(express_2.default.json());
router.use(express_2.default.text());
router.use(express_2.default.urlencoded({ extended: true }));
router.use((req, res, next) => {
    if (req.headers['content-type'] === 'text/plain; charset=utf-8' ||
        req.headers['content-type'] === 'text/plain') {
        try {
            if (typeof req.body === 'string') {
                req.body = JSON.parse(req.body);
            }
        }
        catch (error) {
            console.log('⚠️ Failed to parse text/plain as JSON:', error);
        }
    }
    next();
});
router.post("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const { name, description, color } = req.body;
        if (!name) {
            return res.status(400).json({ error: "Category name is required" });
        }
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const categoryData = { name, description, color };
        const category = await categoriesService.createCategory(req.user.uid, categoryData);
        res.status(201).json({
            message: "Category created successfully",
            data: category
        });
    }
    catch (error) {
        console.error("Create category error:", error);
        res.status(500).json({ error: error.message || "Failed to create category" });
    }
});
router.get("/", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const categories = await categoriesService.getUserCategories(req.user.uid);
        res.json({
            message: "Categories retrieved successfully",
            data: categories
        });
    }
    catch (error) {
        console.error("Get categories error:", error);
        res.status(500).json({ error: error.message || "Failed to get categories" });
    }
});
router.get("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        if (isNaN(categoryId)) {
            return res.status(400).json({ error: "Invalid category ID" });
        }
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const category = await categoriesService.getCategoryById(categoryId, req.user.uid);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.json({
            message: "Category retrieved successfully",
            data: category
        });
    }
    catch (error) {
        console.error("Get category error:", error);
        res.status(500).json({ error: error.message || "Failed to get category" });
    }
});
router.put("/:id", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { name, description, color } = req.body;
        if (isNaN(categoryId)) {
            return res.status(400).json({ error: "Invalid category ID" });
        }
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        const categoryData = {};
        if (name)
            categoryData.name = name;
        if (description !== undefined)
            categoryData.description = description;
        if (color !== undefined)
            categoryData.color = color;
        const updated = await categoriesService.updateCategory(categoryId, categoryData, req.user.uid);
        res.json({
            message: "Category updated successfully",
            data: updated
        });
    }
    catch (error) {
        console.error("Update category error:", error);
        res.status(500).json({ error: error.message || "Failed to update category" });
    }
});
router.post("/:id/delete", auth_middleware_1.authMiddleware, async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        if (isNaN(categoryId)) {
            return res.status(400).json({ error: "Invalid category ID" });
        }
        if (!req.user?.uid) {
            return res.status(401).json({ error: "User not authenticated" });
        }
        await categoriesService.deleteCategory(categoryId, req.user.uid);
        res.json({ message: "Category deleted successfully" });
    }
    catch (error) {
        console.error("Delete category error:", error);
        res.status(500).json({ error: error.message || "Failed to delete category" });
    }
});
exports.default = router;
//# sourceMappingURL=categories.controller.js.map