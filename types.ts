
export interface CourseNode {
  key: string;
  sceneName: string;
  sceneId: string;
  boardName: string;
  knowledgePoints: string[];
  videoUrl?: string;
  objectId?: string | number;
  objectType: string; // 记录原始类型：CalculusBoard 或 Video
  calculusKey?: string; // 专项字段
  errorCount?: number | string; // 错题跳关次数
  questionType?: string; // 题目类型判断
}

export interface SearchResult {
  senseId: string;
  name: string;
  matchedPath: string;
  field: string;
  value: string;
}

export interface CourseExtractionResult {
  nodes: CourseNode[];
  raw: any;
  title?: string;
  pathId: string;
}

export type GroupOption = 'none' | 'knowledge' | 'scene';
export type ElementType = 'CalculusBoard' | 'Video';
