import {createContext} from 'react';
import type {CaptionSettings} from '../config/captions/types';
export const CaptionDefaults=createContext<Partial<CaptionSettings>>({});
