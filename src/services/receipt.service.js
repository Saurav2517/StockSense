import * as ops from './operation.service';

const TYPE = 'RECEIPT';

export const list = (filters = {}) => ops.listOperations({ ...filters, type: TYPE });
export const get = (id) => ops.getOperation(TYPE, id);
export const create = (payload) => ops.createOperation(TYPE, payload);
export const update = (id, payload) => ops.updateOperation(TYPE, id, payload);
export const markReady = (id) => ops.markReady(TYPE, id);
export const validate = (id) => ops.validateOperation(TYPE, id);
export const cancel = (id) => ops.cancelOperation(TYPE, id);
