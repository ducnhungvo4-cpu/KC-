
export enum NodeType {
  TEXT_TO_IMAGE = 'TEXT_TO_IMAGE',
  TEXT_TO_VIDEO = 'TEXT_TO_VIDEO',
  TEXT_TO_AUDIO = 'TEXT_TO_AUDIO',
  IMAGE_TO_IMAGE = 'IMAGE_TO_IMAGE',
  IMAGE_TO_VIDEO = 'IMAGE_TO_VIDEO',
  START_END_TO_VIDEO = 'START_END_TO_VIDEO',
  CREATIVE_DESC = 'CREATIVE_DESC',
  ORIGINAL_IMAGE = 'ORIGINAL_IMAGE',
}

export interface ImageVersionSnapshot {
  url: string;
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution: string;
  count: number;
  promptOptimize: boolean;
  createdAt: number;
}

export interface NodeData {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  
  // State
  prompt?: string;
  imageSrc?: string; // Result or Input (Active Selection)
  videoSrc?: string; // Result (Active Selection)
  audioSrc?: string; // Result (Active Selection)
  outputArtifacts?: string[]; // History/Batch results
  imageVersions?: ImageVersionSnapshot[]; // Image history with generation parameters
  favoriteArtifacts?: string[]; // User-favorited node materials
  isLoading?: boolean;
  errorMessage?: string;
  isStackOpen?: boolean; // UI State for expanded gallery
  auditStatus?: 'auditing' | 'passed'; // Seedance 2.0 compliance audit status
  
  // Configs
  aspectRatio?: string;
  resolution?: string;
  duration?: string; // Video duration (5s, 10s, 15s)
  count?: number;
  model?: string;
  promptOptimize?: boolean; // Prompt Extension/Optimization switch
  swapFrames?: boolean; // For START_END_TO_VIDEO: swap first/last frame order
  voiceId?: string;
  voiceSpeed?: number;
  voicePitch?: number;
  voiceVolume?: number;
  
  // Creative Desc specific
  optimizedPrompt?: string;

  // Project / linear shot context. These fields are optional so existing nodes
  // keep working unchanged; video nodes can carry shot data when imported from the linear pipeline.
  projectId?: string;
  canvasId?: string;
  directorGroupName?: string;
  source?: 'canvas' | 'linear_pipeline' | 'asset_library' | 'material_library' | 'local_upload';
  sourceRefId?: string;
  shotId?: string;
  episodeNo?: number;
  sceneNo?: number;
  shotNo?: number;
  shotName?: string;
  shotDescription?: string;
  linearPageUrl?: string;
  creditEstimate?: number;
  creditStatus?: 'idle' | 'estimated' | 'reserved' | 'confirmed' | 'failed' | 'refunded';

  // Camera movement preset for video generation
  cameraMovement?: string;

  // UI State
  activeToolbarItem?: string;
}

export interface PromptTemplate {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

export interface CameraMovementPreset {
  key: string;
  label: string;
  description: string;
  icon: string;
}

export type AssetLibraryType = 'role' | 'scene' | 'prop';
export type AssetLibraryScope = 'project' | 'public';

export interface AssetLibraryItem {
  id: string;
  type: AssetLibraryType;
  scope?: AssetLibraryScope;
  name: string;
  version: string;
  updatedAt: string;
  previewUrl: string;
  description: string;
  parentId?: string;  // parent asset for hierarchy
  voiceTimbre?: string; // voice timbre for role assets
  episodeNo?: number;
  sceneNo?: number;
  shotNo?: number;
}

export interface MultiAngleOptions {
  angles: string[];
  prompt?: string;
  consistency?: 'standard' | 'high';
  background?: 'keep' | 'clean' | 'solid';
  aspectRatio?: string;
  countPerAngle?: number;
  yaw?: number;
  pitch?: number;
  zoom?: 'wide' | 'medium' | 'close';
  preset?: string;
  targetMode?: 'scene' | 'subject';
}

export interface MultiAngleResult {
  angle: string;
  label: string;
  url: string;
  prompt?: string;
}

export interface InputMedia {
  type: 'image' | 'video' | 'text';
  url: string;
  text?: string;
  title?: string;
  sourceId?: string; // upstream source node id (for audit-status lookup on thumbnails)
  auditStatus?: 'auditing' | 'passed'; // Seedance 2.0 compliance audit status of the source node
}

export interface MaterialLibraryItem {
  id: string;
  nodeId?: string;
  url: string;
  type: 'image' | 'video' | 'text';
  title: string;
  text?: string;
  isFavorite?: boolean;
}

export interface ShotClip {
  id: string;
  episodeNo: number;
  sceneNo: number;
  shotNo: number;
  shotName: string;
  videoUrl: string;
  prompt?: string;
  keyframeUrls: string[];
  audioUrl?: string;
  description?: string;
}

export type AddToAssetType = 'role' | 'scene' | 'prop' | 'shot_clip';

export interface AddToAssetPanelState {
  isOpen: boolean;
  nodeId: string;
  nodeType: 'image' | 'video';
  imageSrc?: string;
  videoSrc?: string;
  title?: string;
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  canvasId?: string;
}

export interface CanvasTransform {
  x: number;
  y: number;
  k: number; // Scale
}

export type DragMode = 'NONE' | 'PAN' | 'DRAG_NODE' | 'SELECT' | 'CONNECT' | 'RESIZE_NODE';

export interface Point {
  x: number;
  y: number;
}

export type CanvasPermissionRole = 'owner' | 'editor' | 'viewer';

export interface ProjectCanvasItem {
  id: string;
  projectId: string;
  name: string;
  owner: string;
  permissionRole: CanvasPermissionRole;
  status: 'active' | 'draft' | 'archived';
  nodeCount: number;
  assetCount: number;
  lastSavedAt: string;
  createdAt: string;
  entrySource?: 'canvas_space' | 'linear_workflow';
}

export interface CanvasPermission {
  id: string;
  canvasId: string;
  userName: string;
  role: CanvasPermissionRole;
  updatedAt: string;
}
