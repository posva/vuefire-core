import { bindDocument, walkSet } from '../src'
import { db, spyUnbind, createOps } from '@posva/vuefire-test-helpers'

describe('documents', () => {
  let collection, document, vm, resolve, reject, ops
  beforeEach(async () => {
    collection = db.collection()
    document = collection.doc()
    ops = createOps(walkSet)
    vm = {}
    await new Promise((res, rej) => {
      resolve = jest.fn(res)
      reject = jest.fn(rej)
      bindDocument({ vm, key: 'item', document, resolve, reject, ops })
    })
  })

  it('does not call anything if document does not exist', () => {
    expect(ops.add).not.toHaveBeenCalled()
    expect(ops.set).not.toHaveBeenCalled()
    expect(ops.remove).not.toHaveBeenCalled()
    expect(resolve).toHaveBeenCalled()
    expect(reject).not.toHaveBeenCalled()
  })

  it('updates a document', async () => {
    await document.update({ foo: 'foo' })
    expect(ops.add).not.toHaveBeenCalled()
    expect(ops.set).toHaveBeenCalledTimes(1)
    expect(ops.set).toHaveBeenLastCalledWith(vm, 'item', { foo: 'foo' })
    expect(ops.remove).not.toHaveBeenCalled()
    await document.update({ bar: 'bar' })
    expect(ops.set).toHaveBeenCalledTimes(2)
    expect(ops.set).toHaveBeenLastCalledWith(vm, 'item', { bar: 'bar', foo: 'foo' })
  })

  it('adds non-enumerable id', async () => {
    document = collection.doc('some-id')
    bindDocument({ vm, document, key: 'item', resolve, reject, ops })
    await document.update({ foo: 'foo' })
    expect(Object.getOwnPropertyDescriptor(vm.item, 'id')).toEqual({
      configurable: false,
      enumerable: false,
      writable: false,
      value: 'some-id'
    })
  })

  it('manually unbinds a document', async () => {
    document = collection.doc()
    await document.update({ foo: 'foo' })
    const unbindSpy = spyUnbind(document)
    let unbind
    await new Promise((resolve, reject) => {
      unbind = bindDocument({ vm, document, key: 'item', resolve, reject, ops })
    })

    expect(unbindSpy).not.toHaveBeenCalled()
    expect(vm.item).toEqual({ foo: 'foo' })
    unbind()
    expect(unbindSpy).toHaveBeenCalled()

    // reset data manually
    vm.item = null
    await document.update({ foo: 'foo' })
    expect(vm.item).toEqual(null)
    unbindSpy.mockRestore()
  })

  it('rejects when errors', async () => {
    const fakeOnSnapshot = (_, fail) => {
      fail(new Error('nope'))
    }
    document = collection.doc()
    document.onSnapshot = jest.fn(fakeOnSnapshot)
    await expect(
      new Promise((resolve, reject) => {
        bindDocument({ vm, document, key: 'item', resolve, reject, ops })
      })
    ).rejects.toThrow()
    document.onSnapshot.mockRestore()
  })

  it('resolves when the document is set', async () => {
    await document.update({ foo: 'foo' })
    const promise = new Promise((resolve, reject) => {
      bindDocument({ vm, document, key: 'item', resolve, reject, ops })
    })
    await promise
    expect(vm.item).toEqual({ foo: 'foo' })
  })
})
