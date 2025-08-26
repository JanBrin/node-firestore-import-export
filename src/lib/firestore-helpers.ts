import * as admin from 'firebase-admin';
import loadJsonFile from 'load-json-file';
import {IFirebaseCredentials} from '../interfaces/IFirebaseCredentials';

const SLEEP_TIME = 1000;

const getCredentialsFromFile = (credentialsFilename: string): Promise<IFirebaseCredentials> => {
  return loadJsonFile(credentialsFilename);
};

const getFirestoreDBReference = (credentials: IFirebaseCredentials): admin.firestore.Firestore => {
  admin.initializeApp({
    credential: admin.credential.cert(credentials as any),
    databaseURL: `https://${(credentials as any).project_id}.firebaseio.com`,
  });

  return admin.firestore();
};

const getDBReferenceFromPath = (db: admin.firestore.Firestore, dataPath?: string): admin.firestore.Firestore |
  admin.firestore.DocumentReference |
  admin.firestore.CollectionReference => {
  let startingRef;
  if (dataPath) {
    const parts = dataPath.split('/').length;
    const isDoc = parts % 2 === 0;
    startingRef = isDoc ? db.doc(dataPath) : db.collection(dataPath);
  } else {
    startingRef = db;
  }
  return startingRef;
};

const isLikeDocument = (ref: admin.firestore.Firestore |
  admin.firestore.DocumentReference |
  admin.firestore.CollectionReference): ref is admin.firestore.DocumentReference => {
  return (<admin.firestore.DocumentReference>ref).collection !== undefined;
};

const isRootOfDatabase = (ref: admin.firestore.Firestore |
  admin.firestore.DocumentReference |
  admin.firestore.CollectionReference): ref is admin.firestore.Firestore => {
  return (<admin.firestore.Firestore>ref).batch !== undefined;
};

const sleep = (timeInMS: number): Promise<void> => new Promise(resolve => setTimeout(resolve, timeInMS));

const batchExecutor = async function <T>(promiseGenerators: (() => Promise<T>)[], batchSize: number = 50) {
  const res: T[] = [];
  while (promiseGenerators.length > 0) {
    const promises = promiseGenerators.splice(0, batchSize).map(generator => generator());
    res.push(...await Promise.all(promises));
  }
  return res;
};

const safelyGetCollectionsSnapshot = async (startingRef: admin.firestore.Firestore | admin.firestore.DocumentReference, logs = false): Promise<admin.firestore.CollectionReference[]> => {
  let collectionsSnapshot, deadlineError = false;
  do {
    try {
      collectionsSnapshot = await startingRef.listCollections();
      deadlineError = false;
    } catch (e) {
      if (e instanceof Error && e.message === 'Deadline Exceeded') {
        logs && console.log(`Deadline Error in getCollections()...waiting ${SLEEP_TIME / 1000} second(s) before retrying`);
        await sleep(SLEEP_TIME);
        deadlineError = true;
      } else {
        throw e;
      }
    }
  } while (deadlineError || !collectionsSnapshot);
  return collectionsSnapshot;
};

const safelyGetDocumentReferences = async (collectionRef: admin.firestore.CollectionReference, logs = false): Promise<admin.firestore.DocumentReference[]> => {
  let allDocuments, deadlineError = false;
  do {
    try {
      allDocuments = await collectionRef.listDocuments();
      deadlineError = false;
    } catch (e) {
      if ((e as any).code === 4) {
        logs && console.log(`Deadline Error in getDocuments()...waiting ${SLEEP_TIME / 1000} second(s) before retrying`);
        await sleep(SLEEP_TIME);
        deadlineError = true;
      } else {
        throw e;
      }
    }
  } while (deadlineError || !allDocuments);
  return allDocuments;
};

type anyFirebaseRef = admin.firestore.Firestore |
  admin.firestore.DocumentReference |
  admin.firestore.CollectionReference

export {
  getCredentialsFromFile,
  getFirestoreDBReference,
  getDBReferenceFromPath,
  isLikeDocument,
  isRootOfDatabase,
  sleep,
  batchExecutor,
  anyFirebaseRef,
  safelyGetCollectionsSnapshot,
  safelyGetDocumentReferences,
};
