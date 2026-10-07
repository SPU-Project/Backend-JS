import { z } from "zod";

export const createRecipeSchema = z.object({
  namaProduk: z.string().trim().min(1, "Nama produk wajib diisi"),
  kodeProduksi: z.string().trim().optional(),
  shelfLifeDays: z.coerce.number().int().positive().default(365),
  bahanBaku: z
    .array(
      z.object({
        id: z.coerce.number().int().positive("ID bahan baku tidak valid"),
        jumlah: z.coerce.number().positive("Jumlah bahan baku harus lebih dari 0"),
      })
    )
    .min(1, "Resep harus memiliki minimal 1 bahan baku"),
  kemasan: z
    .array(
      z.object({
        namaKemasan: z.string().trim().min(1, "Nama kemasan wajib diisi"),
        harga: z.coerce.number().nonnegative("Harga kemasan tidak boleh negatif"),
      })
    )
    .default([]),
  overhead: z
    .array(
      z.object({
        namaOverhead: z.string().trim().min(1, "Nama overhead wajib diisi"),
        harga: z.coerce.number().nonnegative("Harga overhead tidak boleh negatif"),
      })
    )
    .default([]),
});

export const updateRecipeSchema = createRecipeSchema;

export const createProductionOrderSchema = z.object({
  productId: z.coerce.number().int().positive("ID produk tidak valid"),
  plannedQty: z.coerce.number().positive("Jumlah rencana produksi harus lebih besar dari 0"),
  notes: z.string().trim().optional(),
});

export const completeProductionOrderSchema = z.object({
  actualYield: z.coerce.number().positive("Hasil produksi aktual harus lebih besar dari 0"),
  manufactureDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal produksi harus YYYY-MM-DD")
    .optional(),
  shelfLifeDays: z.coerce.number().int().positive().optional(),
});
