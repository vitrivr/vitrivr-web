/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InputData } from './InputData';
import type { OperatorDescription } from './OperatorDescription';
import type { QueryContext } from './QueryContext';
export type InformationNeedDescription = {
    inputs: Record<string, InputData>;
    operations: Record<string, OperatorDescription>;
    output: string;
    context: QueryContext;
};

