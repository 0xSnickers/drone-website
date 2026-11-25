import { http } from '@/services/http';
import type { SystemStatus } from '../types';

export const getSystemStatus = () => http.get<SystemStatus>('/system/status');
