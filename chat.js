
import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";

import {
    collection,
    doc,
    getDoc,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


/* =====================================
   ELEMENTS
===================================== */

const messagesContainer = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");

const chatNotice = document.getElementById("chatNotice");

const params = new URLSearchParams(window.location.search);
const requestId = params.get("requestId");

let currentUser = null;
let currentUserName = "Campus Member";
let unsubscribeMessages = null;
let chatReady = false;
let sendingMessage = false;


/* =====================================
   UI HELPERS
===================================== */

function showNotice(message, type = "info") {
    chatNotice.textContent = message;
    chatNotice.className = `chat-notice ${type}`;
}

function setComposerEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendButton.disabled = !enabled;
}

function setSending(sending) {
    sendingMessage = sending;

    sendButton.disabled = sending;
    sendButton.textContent = sending ? "Sending..." : "Send";
}

function createMessageElement(message, messageId) {
    const wrapper = document.createElement("div");

    const isMine = message.senderId === currentUser.uid;

    wrapper.className = `message ${isMine ? "mine" : "theirs"}`;
    wrapper.dataset.messageId = messageId;

    const sender = document.createElement("div");
    sender.className = "sender";
    sender.textContent = isMine
        ? "You"
        : (message.senderName || "Campus Member");

    const text = document.createElement("p");
    text.textContent = message.text || "";

    const time = document.createElement("small");

    if (message.createdAt?.toDate) {
        time.textContent = message.createdAt.toDate().toLocaleString();
    } else {
        time.textContent = "Sending...";
    }

    wrapper.append(sender, text, time);

    return wrapper;
}

function scrollToLatestMessage() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function clearMessageSubscription() {
    if (unsubscribeMessages) {
        unsubscribeMessages();
        unsubscribeMessages = null;
    }
}


/* =====================================
   LOAD USER PROFILE
===================================== */

async function loadCurrentUserName() {
    const userRef = doc(db, "users", currentUser.uid);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
        const profile = snapshot.data();

        currentUserName =
            profile.displayName ||
            currentUser.displayName ||
            currentUser.email.split("@")[0];

    } else {
        currentUserName =
            currentUser.displayName ||
            currentUser.email.split("@")[0];
    }
}


/* =====================================
   VALIDATE CHAT ACCESS
===================================== */

async function validateChatAccess() {
    if (!requestId) {
        throw new Error("INVALID_REQUEST");
    }

    const requestRef = doc(db, "borrowRequests", requestId);
    const requestSnapshot = await getDoc(requestRef);

    if (!requestSnapshot.exists()) {
        throw new Error("REQUEST_NOT_FOUND");
    }

    const request = requestSnapshot.data();

    const isOwner = request.ownerId === currentUser.uid;
    const isBorrower = request.borrowerId === currentUser.uid;

    if (!isOwner && !isBorrower) {
        throw new Error("NOT_AUTHORIZED");
    }

    const title = document.querySelector(".chat-header h2");
    const subtitle = document.querySelector(".chat-header p");

    if (title) {
        title.textContent = request.itemName || "Resource Chat";
    }

    if (subtitle) {
        subtitle.textContent = isOwner
            ? `Chat with ${request.borrowerName || "Borrower"}`
            : `Chat with ${request.ownerName || "Owner"}`;
    }

    return request;
}


/* =====================================
   REAL-TIME MESSAGES
===================================== */

function listenForMessages() {
    clearMessageSubscription();

    messagesContainer.innerHTML = "";

    const messagesRef = collection(
        db,
        "borrowRequests",
        requestId,
        "messages"
    );

    const messagesQuery = query(
        messagesRef,
        orderBy("createdAt", "asc")
    );

    unsubscribeMessages = onSnapshot(
        messagesQuery,

        snapshot => {
            messagesContainer.innerHTML = "";

            if (snapshot.empty) {
                const empty = document.createElement("p");
                empty.className = "empty-chat";
                empty.textContent =
                    "No messages yet. Start the conversation.";

                messagesContainer.appendChild(empty);
                return;
            }

            snapshot.forEach(messageDocument => {
                const message = messageDocument.data();

                const messageElement = createMessageElement(
                    message,
                    messageDocument.id
                );

                messagesContainer.appendChild(messageElement);
            });

            scrollToLatestMessage();
        },

        error => {
            console.error("Message listener error:", error);

            showNotice(
                "Unable to load messages. Please refresh the page.",
                "error"
            );
        }
    );
}


/* =====================================
   SEND MESSAGE
===================================== */

async function sendMessage(event) {
    event.preventDefault();

    if (!chatReady || !currentUser || sendingMessage) {
        return;
    }

    const text = messageInput.value.trim();

    if (!text) {
        return;
    }

    if (text.length > 2000) {
        showNotice("Messages cannot exceed 2000 characters.", "error");
        return;
    }

    try {
        await currentUser.reload();
        currentUser = auth.currentUser;

        if (!currentUser || !currentUser.emailVerified) {
            showNotice(
                "Please verify your email before sending messages.",
                "error"
            );
            return;
        }

        setSending(true);

        await addDoc(
            collection(db, "borrowRequests", requestId, "messages"),
            {
                senderId: currentUser.uid,
                senderName: currentUserName,
                text,
                createdAt: serverTimestamp()
            }
        );

        messageInput.value = "";
        messageInput.focus();

        showNotice("");

    } catch (error) {
        console.error("Send message error:", error);

        showNotice(
            error.code === "permission-denied"
                ? "You do not have permission to send this message."
                : "Message could not be sent. Please try again.",
            "error"
        );

    } finally {
        setSending(false);
    }
}


/* =====================================
   AUTHENTICATION
===================================== */

function initializeComposer() {
    setComposerEnabled(true);
    chatReady = true;

    chatForm.addEventListener("submit", sendMessage);
}

onAuthStateChanged(auth, async user => {
    clearMessageSubscription();

    chatReady = false;
    currentUser = user;

    setComposerEnabled(false);

    if (!user) {
        showNotice("Please login to access this chat.", "error");
        return;
    }

    try {
        await user.reload();
        currentUser = auth.currentUser;

        if (!currentUser || !currentUser.emailVerified) {
            showNotice(
                "Please verify your email before accessing chat.",
                "error"
            );
            return;
        }

        await loadCurrentUserName();
        await validateChatAccess();

        initializeComposer();
        listenForMessages();

        showNotice("");

    } catch (error) {
        console.error("Chat initialization error:", error);

        const messages = {
            INVALID_REQUEST: "Invalid chat link.",
            REQUEST_NOT_FOUND: "Borrow request not found.",
            NOT_AUTHORIZED: "You are not authorized to access this chat."
        };

        showNotice(
            messages[error.message] ||
            "Unable to open chat. Please try again.",
            "error"
        );
    }
});


/* =====================================
   CLEANUP
===================================== */

window.addEventListener("pagehide", () => {
    clearMessageSubscription();
});
