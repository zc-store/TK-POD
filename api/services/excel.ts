import xlsx from 'xlsx';
import fs from 'fs';

export interface CarpetSize {
  size_cm: string;
  production_size_cm: string;
  cost_price: number;
  material: string;
  sku_category?: string;
  weight_g?: number;
  packaging_weight_g?: number;
  packaging_size_cm?: string;
}

export interface ExcelReadResult {
  success: boolean;
  sizes?: CarpetSize[];
  rawData?: Record<string, unknown>[];
  error?: string;
}

class ExcelService {
  async readCarpetSizes(filePath: string): Promise<ExcelReadResult> {
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: 'File not found',
        };
      }

      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = xlsx.utils.sheet_to_json(worksheet);
      
      const sizes: CarpetSize[] = jsonData.map((row: Record<string, unknown>) => ({
        size_cm: String(row['产品尺寸CM'] || row['尺寸'] || row['Size'] || row['size'] || ''),
        production_size_cm: String(row['生产图尺寸（cm）'] || row['生产尺寸'] || row['Production Size'] || row['production_size'] || ''),
        cost_price: parseFloat(String(row['出厂价RMB（不含税运）'] || row['成本'] || row['Cost'] || row['cost'] || '0')),
        material: String(row['材质'] || row['Material'] || row['material'] || '面料100%聚酯纤维+内胆聚氨酯'),
        sku_category: String(row['SKU分类'] || ''),
        weight_g: Number(row['产品重量G'] || row['产品重量'] || row['weight'] || 0),
        packaging_weight_g: Number(row['含包装重量G'] || row['包装重量'] || 0),
        packaging_size_cm: String(row['包装尺寸CM'] || row['包装尺寸'] || ''),
      })).filter((item) => item.size_cm && item.cost_price > 0);

      return {
        success: true,
        sizes,
        rawData: jsonData as Record<string, unknown>[],
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export default ExcelService;
