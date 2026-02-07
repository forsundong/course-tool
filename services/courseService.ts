
import { CourseExtractionResult, CourseNode } from '../types';

/**
 * 优化的元数据提取器：单次遍历获取知识点和视频 URL
 */
const extractMetadata = (obj: any) => {
  let knowledge: any = null;
  let videoUrl = '';

  const stack: { node: any; depth: number }[] = [{ node: obj, depth: 0 }];
  const videoFields = ['videoUrl', 'url', 'src', 'videoSrc', 'video', 'source'];

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (!node || depth > 6) continue;

    // 提取知识点 (仅取第一个找到的)
    if (!knowledge && node.knowledge !== undefined) {
      knowledge = node.knowledge;
    }

    // 提取视频 URL (仅取第一个找到的)
    if (!videoUrl) {
      for (const field of videoFields) {
        const val = node[field];
        if (typeof val === 'string' && val.trim().startsWith('http')) {
          videoUrl = val;
          break;
        } else if (typeof val === 'object' && val?.httpPre && val?.relativePath) {
          const pre = val.httpPre.endsWith('/') ? val.httpPre : val.httpPre + '/';
          videoUrl = pre + val.relativePath + (val.suffix || '');
          break;
        }
      }
    }

    // 如果两者都找到了，提前退出
    if (knowledge && videoUrl) break;

    // 继续深度搜索
    if (typeof node === 'object') {
      const keys = Object.keys(node);
      for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        const val = node[key];
        if (val && typeof val === 'object' && key !== 'checkpoints' && key !== 'nodes') {
          stack.push({ node: val, depth: depth + 1 });
        }
      }
    }
  }

  return { knowledge, videoUrl };
};

/**
 * 格式化知识点
 */
export const formatKnowledge = (k: any): string[] => {
  if (!k) return [];
  if (Array.isArray(k)) {
    return k.map(i => (typeof i === 'string' ? i : i.name || i.title || i.knowledgeName || String(i)));
  }
  if (typeof k === 'string' && k.trim()) {
    if (k.startsWith('[') || k.startsWith('{')) {
      try {
        const p = JSON.parse(k);
        return Array.isArray(p) ? p.map(String) : [String(p)];
      } catch { return [k]; }
    }
    return [k];
  }
  return typeof k === 'object' ? [k.name || k.title || String(k)] : [];
};

/**
 * 全局搜索优化
 */
export const deepSearch = (obj: any, field: string, value: string, path = ''): string | null => {
  if (!obj || typeof obj !== 'object') return null;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const res = deepSearch(obj[i], field, value, `${path}[${i}]`);
      if (res) return res;
    }
    return null;
  }
  if (obj.hasOwnProperty(field) && String(obj[field]).includes(value)) {
    return path || 'root';
  }
  const keys = Object.keys(obj);
  for (const k of keys) {
    const res = deepSearch(obj[k], field, value, path ? `${path}.${k}` : k);
    if (res) return res;
  }
  return null;
};

export const fetchCoursePathData = async (pathId: string): Promise<CourseExtractionResult> => {
  const url = `https://tms-mx.xueqiulearning.com/merton-backend/arrangement/detail/${pathId}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API 错误: ${response.status}`);
  const result = await response.json();
  if (result.code !== 0 && result.code !== 200) throw new Error(result.message || '业务逻辑错误');
  return processJsonData(result, pathId);
};

export const processJsonData = (json: any, pathId: string): CourseExtractionResult => {
  const nodes: CourseNode[] = [];
  const rawData = json.data || {};

  // 1. 建立 Checkpoint 索引化 Map
  const checkpointMap = new Map<number, any>();
  if (Array.isArray(rawData.checkpoints)) {
    rawData.checkpoints.forEach((cp: any) => {
      if (cp.checkpointId !== undefined) {
        checkpointMap.set(cp.checkpointId, cp);
      }
    });
  }

  const fastScanner = (item: any, sId: string, sName: string) => {
    if (!item || typeof item !== 'object') return;

    let currentSId = sId;
    let currentSName = sName;

    const rawType = item.objectType || '';
    const type = String(rawType).toLowerCase();

    if (type === 'sense' || type === 'scene' || item.senseId || item.sceneId) {
      currentSId = String(item.senseId || item.sceneId || item.id || sId);
      currentSName = item.name || item.title || sName;
    }

    if (type === 'calculusboard' || type === 'video') {
      const { knowledge, videoUrl } = extractMetadata(item);
      const kps = formatKnowledge(knowledge);
      const boardName = item.objectName || item.name || (type === 'video' ? '视频元素' : '演算板');
      const boardLevelKey = item.calculusKey || item.checkpointKey || item.key || (item.config?.calculusKey);

      // 提取关卡相关信息
      const cpId = item.checkpointId || item.config?.checkpointId;
      const cpInfo = cpId ? checkpointMap.get(Number(cpId)) : null;

      // 题目类型判断：nodes 数组里是否有任何一个节点包含 questionId
      const isMortonQuestion = cpInfo?.nodes?.some(
        (n: any) => n.questionId !== undefined && n.questionId !== null
      );
      const questionType = cpId ? (isMortonQuestion ? "莫顿题" : "研发题") : "-";
      const errorCount = cpInfo?.errorCount ?? "-";

      const cps = item.checkpoints || item.config?.checkpoints || [item];
      
      for (const cp of cps) {
        if (!cp) continue;
        const finalKey = cp.checkpointKey || cp.key || boardLevelKey || 'N/A';

        nodes.push({
          key: finalKey,
          sceneId: currentSId,
          sceneName: currentSName,
          boardName,
          knowledgePoints: kps,
          videoUrl: videoUrl || '',
          objectId: item.objectId || item.id,
          objectType: rawType,
          calculusKey: finalKey,
          errorCount: errorCount,
          questionType: questionType
        });
      }
      return; 
    }

    if (Array.isArray(item)) {
      for (const el of item) fastScanner(el, currentSId, currentSName);
    } else {
      for (const k in item) {
        if (k !== 'checkpoints' && k !== 'nodes' && k !== 'config') {
          fastScanner(item[k], currentSId, currentSName);
        }
      }
    }
  };

  fastScanner(rawData, '0', '默认场景');
  
  // 排序逻辑：名称为“笔记”的演算板始终排在最后
  nodes.sort((a, b) => {
    const aIsNote = a.boardName === '笔记';
    const bIsNote = b.boardName === '笔记';
    
    if (aIsNote && !bIsNote) return 1;
    if (!aIsNote && bIsNote) return -1;
    
    // 如果同为笔记或同不为笔记，则按 objectId 排序
    return Number(a.objectId || 0) - Number(b.objectId || 0);
  });

  return { nodes, raw: json, title: rawData.name || rawData.title || `路径 ${pathId}`, pathId };
};
