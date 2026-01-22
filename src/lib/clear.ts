import {
  batchExecutor,
  isLikeDocument,
  isRootOfDatabase,
  safelyGetCollectionsSnapshot,
  safelyGetDocumentReferences,
} from './firestore-helpers';
import * as admin from 'firebase-admin';
import {DocumentReference, CollectionReference} from 'firebase-admin/firestore';

const clearData = async (startingRef: admin.firestore.Firestore |
  DocumentReference |
  CollectionReference, logs = false) => {
  if (isLikeDocument(startingRef)) {
    const promises: Promise<any>[] = [clearCollections(startingRef, logs)];
    if (!isRootOfDatabase(startingRef)) {
      promises.push(startingRef.delete() as Promise<any>);
    }
    return Promise.all(promises);
  } else {
    return clearDocuments(<CollectionReference>startingRef, logs);
  }
};

const clearCollections = async (startingRef: admin.firestore.Firestore | DocumentReference, logs = false) => {
  const collectionPromises: Array<() => Promise<any>> = [];
  const collectionsSnapshot = await safelyGetCollectionsSnapshot(startingRef, logs);
  collectionsSnapshot.map((collectionRef: CollectionReference) => {
    collectionPromises.push(() => clearDocuments(collectionRef, logs));
  });
  return batchExecutor(collectionPromises);
};

const clearDocuments = async (collectionRef: CollectionReference, logs = false) => {
  logs && console.log(`Retrieving documents from ${collectionRef.path}`);
  const allDocuments = await safelyGetDocumentReferences(collectionRef, logs);
  const documentPromises: Array<() => Promise<object>> = [];
  allDocuments.forEach((docRef: DocumentReference) => {
    documentPromises.push(() => clearCollections(docRef, logs));
    documentPromises.push(() => docRef.delete());
  });
  return batchExecutor(documentPromises);
};

export default clearData;