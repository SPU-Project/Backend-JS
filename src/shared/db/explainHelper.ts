const db = require("../../../config/Database.js");

export interface ExplainResult {
  query: string;
  nodeType: string;
  indexName?: string;
  executionTimeMs: number;
  planningTimeMs: number;
  totalCost: number;
  isIndexScan: boolean;
  rawPlan: any;
}

export class ExplainHelper {
  /**
   * Run EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) on a given SQL query
   */
  static async explainQuery(sql: string, replacements: any[] = []): Promise<ExplainResult> {
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
    const [results] = await db.query(explainSql, { replacements });

    const planWrapper = results[0];
    const planData = planWrapper["QUERY PLAN"][0];
    const topNode = planData["Plan"];

    // Find any index scan in the node hierarchy
    const findIndexNode = (node: any): any => {
      if (node["Node Type"]?.includes("Index") || node["Index Name"]) {
        return node;
      }
      if (node["Plans"] && Array.isArray(node["Plans"])) {
        for (const child of node["Plans"]) {
          const found = findIndexNode(child);
          if (found) return found;
        }
      }
      return null;
    };

    const indexNode = findIndexNode(topNode);
    const nodeType = indexNode ? indexNode["Node Type"] : topNode["Node Type"];
    const indexName = indexNode ? indexNode["Index Name"] : undefined;
    const isIndexScan = nodeType?.includes("Index") || false;

    return {
      query: sql,
      nodeType,
      indexName,
      executionTimeMs: planData["Execution Time"] || 0,
      planningTimeMs: planData["Planning Time"] || 0,
      totalCost: topNode["Total Cost"] || 0,
      isIndexScan,
      rawPlan: planData,
    };
  }
}
