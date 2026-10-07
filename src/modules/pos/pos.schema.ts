import { z } from "zod";

export const posCheckoutSchema = z
  .object({
    storeId: z.coerce.number().int().positive("ID toko tidak valid"),
    customerId: z.coerce.number().int().positive("ID customer tidak valid").optional(),
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive("ID produk tidak valid"),
          qty: z.coerce.number().positive("Jumlah beli harus lebih besar dari 0"),
        })
      )
      .min(1, "Keranjang belanja minimal memuat 1 barang"),
    discount: z.coerce.number().nonnegative("Diskon tidak boleh negatif").default(0),
    payments: z
      .array(
        z.object({
          method: z.enum(["cash", "qris", "transfer", "tempo"], {
            errorMap: () => ({ message: "Metode pembayaran harus cash, qris, transfer, atau tempo" }),
          }),
          amount: z.coerce.number().positive("Nominal pembayaran harus lebih dari 0"),
          referenceNumber: z.string().trim().optional(),
        })
      )
      .min(1, "Minimal harus ada 1 metode pembayaran"),
    tempoDueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format jatuh tempo tempo harus YYYY-MM-DD")
      .optional(),
    notes: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const hasTempo = data.payments.some((p) => p.method === "tempo");
      if (hasTempo && !data.customerId) {
        return false;
      }
      return true;
    },
    {
      message: "Pembayaran tempo (kasbon/yarnen) mewajibkan customer terdaftar.",
      path: ["customerId"],
    }
  );
