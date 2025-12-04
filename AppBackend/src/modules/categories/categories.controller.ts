import { Router, Response } from "express";
import { CategoriesService, CreateCategoryData } from "./categories.service";
import { authMiddleware, AuthenticatedRequest } from "../../middleware/auth.middleware";
import express from "express";

const router = Router();
const categoriesService = new CategoriesService();

// Adicionar middleware para processar diferentes tipos de conteúdo
router.use(express.json());
router.use(express.text());
router.use(express.urlencoded({ extended: true }));

// Middleware customizado para processar text/plain como JSON
router.use((req, res, next) => {
  if (req.headers['content-type'] === 'text/plain; charset=utf-8' || 
      req.headers['content-type'] === 'text/plain') {
    try {
      if (typeof req.body === 'string') {
        req.body = JSON.parse(req.body);
      }
    } catch (error) {
      console.log('⚠️ Failed to parse text/plain as JSON:', error);
    }
  }
  next();
});

// Create a new category for user
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, description, color } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }

    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const categoryData: CreateCategoryData = { name, description, color };
    const category = await categoriesService.createCategory(req.user.uid, categoryData);
    res.status(201).json({ 
      message: "Category created successfully", 
      data: category 
    });
  } catch (error: any) {
    console.error("Create category error:", error);
    res.status(500).json({ error: error.message || "Failed to create category" });
  }
});

// Get user's categories
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const categories = await categoriesService.getUserCategories(req.user.uid);
    res.json({ 
      message: "Categories retrieved successfully",
      data: categories 
    });
  } catch (error: any) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: error.message || "Failed to get categories" });
  }
});

// Get category by ID
router.get("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error: any) {
    console.error("Get category error:", error);
    res.status(500).json({ error: error.message || "Failed to get category" });
  }
});

// Update category
router.put("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    const { name, description, color } = req.body;

    if (isNaN(categoryId)) {
      return res.status(400).json({ error: "Invalid category ID" });
    }

    if (!req.user?.uid) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const categoryData: Partial<CreateCategoryData> = {};
    if (name) categoryData.name = name;
    if (description !== undefined) categoryData.description = description;
    if (color !== undefined) categoryData.color = color;

    const updated = await categoriesService.updateCategory(categoryId, categoryData, req.user.uid);
    res.json({ 
      message: "Category updated successfully", 
      data: updated 
    });
  } catch (error: any) {
    console.error("Update category error:", error);
    res.status(500).json({ error: error.message || "Failed to update category" });
  }
});

// Delete category
router.post("/:id/delete", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
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
  } catch (error: any) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: error.message || "Failed to delete category" });
  }
});

export default router;
