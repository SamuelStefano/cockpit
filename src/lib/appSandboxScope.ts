import * as React from 'react';
import {
  Badge,
  Button,
  CodeBlock,
  ConnDot,
  EmptyState,
  Icon,
  Input,
  Markdown,
  Modal,
  ProgressBar,
  RouteHeader,
  Skeleton,
  SkeletonCards,
  Stat,
  Tabs,
  fireConfetti,
  toast,
  tokens,
} from '../components/primitives';

// Tudo que o sandbox do modo App enxerga sem escrever import. São os componentes
// REAIS do app — não cópias — que é o ponto do modo: o que quebrar aqui quebra em
// produção do mesmo jeito.
export const APP_SCOPE = {
  React,
  Badge,
  Button,
  CodeBlock,
  ConnDot,
  EmptyState,
  Icon,
  Input,
  Markdown,
  Modal,
  ProgressBar,
  RouteHeader,
  Skeleton,
  SkeletonCards,
  Stat,
  Tabs,
  fireConfetti,
  toast,
  tokens,
} as const;

export const APP_SCOPE_NAMES = Object.keys(APP_SCOPE).sort();
