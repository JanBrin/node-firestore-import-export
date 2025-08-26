import {
  batchExecutor,
  isLikeDocument,
  isRootOfDatabase,
  safelyGetCollectionsSnapshot,
  safelyGetDocumentReferences,
} from './firestore-helpers';
import * as admin from 'firebase-admin';
import DocumentReference = admin.firestore.DocumentReference;

const clearData = async (startingRef: admin.firestore.Firestore |
  admin.firestore.DocumentReference |
  admin.firestore.CollectionReference, logs = false) => {
  if (isLikeDocument(startingRef)) {
    const promises: Promise<any>[] = [clearCollections(startingRef, logs)];
    if (!isRootOfDatabase(startingRef)) {
      promises.push(startingRef.delete() as Promise<any>);
    }
    return Promise.all(promises);
  } else {
    return clearDocuments(<admin.firestore.CollectionReference>startingRef, logs);
  }
};

const clearCollections = async (startingRef: admin.firestore.Firestore | admin.firestore.DocumentReference, logs = false) => {
  const collectionPromises: Array<() => Promise<any>> = [];
  const collectionsSnapshot = await safelyGetCollectionsSnapshot(startingRef, logs);
  collectionsSnapshot.map((collectionRef: admin.firestore.CollectionReference) => {
    collectionPromises.push(() => clearDocuments(collectionRef, logs));
  });
  return batchExecutor(collectionPromises);
};

const clearDocuments = async (collectionRef: admin.firestore.CollectionReference, logs = false) => {
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