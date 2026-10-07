import { z } from "zod";

export const createStoreSchema = z.object({
  storeCode: z.string().trim().min(2, "Kode cabang minimal 2 karakter"),
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter"),
  type: z.enum(["warehouse_hq", "outlet"]).default("outlet"),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Nama pelanggan wajib diisi"),
  nik: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  type: z.enum(["farmer", "retail_shop", "distributor"]).default("farmer"),
  poktanName: z.string().trim().optional(),
  creditLimit: z.coerce.number().nonnegative("Credit limit tidak boleh negatif").default(0),
});

export const updateCreditLimitSchema = z.object({
  creditLimit: z.coerce.number().nonnegative("Credit limit tidak boleh negatif"),
});

export const setStorePriceSchema = z.object({
  storeId: z.coerce.number().int().positive("ID store tidak valid"),
  productId: z.coerce.number().int().positive("ID produk tidak valid"),
  sellingPrice: z.coerce.number().positive("Harga jual harus lebih besar dari 0"),
});

export const transferStockSchema = z.object({
  fromStoreId: z.coerce.number().int().positive("ID cabang asal tidak valid"),
  toStoreId: z.coerce.number().int().positive("ID cabang tujuan tidak valid"),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive("ID produk tidak valid"),
        qty: z.coerce.number().positive("Jumlah transfer harus lebih dari 0"),
      })
    )
    .min(1, "Minimal harus ada 1 produk yang ditransfer"),
  notes: z.string().trim().optional(),
});
