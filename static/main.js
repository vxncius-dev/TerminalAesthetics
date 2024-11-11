import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

class ChatApp {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash"
    });
    this.chatContainer = document.getElementById("chat");
    this.inputChat = document.getElementById("messageInput");
    this.messageList = document.getElementById("messageList");
    this.backDownButton = document.getElementById("backDown");
    this.newChatButton = document.getElementById("newChat");
    this.currentConversationId = null;

    this.setupEventListeners();
    this.renderConversationsList();
  }

  setupEventListeners() {
    document.getElementById("conversationsList").addEventListener("change", (event) => {
      const selectedConversationId = event.target.value;
      if (selectedConversationId) this.selectConversation(selectedConversationId);
    });

    document.body.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        const inputText = this.inputChat.textContent;
        if (inputText === "deleteThis") {
          this.deleteConversation(this.currentConversationId);
          this.inputChat.textContent = "";
        } else {
          this.sendMessage();
          this.inputChat.textContent = "";
        }
        this.inputChat.focus();
      }
    });

    this.chatContainer.addEventListener("click", () => this.inputChat.focus());
    this.chatContainer.addEventListener("scroll", () => this.handleScroll());
    this.backDownButton.addEventListener("click", () => this.scrollToBottom());
    this.newChatButton.addEventListener("click", () => this.createNewChat());

    this.inputChat.addEventListener("input", (e) => {
      if (e.key !== "Esc") {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
        this.scrollToBottom();
      }
      if (this.inputChat.scrollHeight > this.lastInputHeight) {
        this.lastInputHeight = this.inputChat.scrollHeight;
        this.scrollToBottom();
      }
    });
  }

  removeEmojis(text) {
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{1F004}-\u{1F0CF}\u{2B06}\u{2194}\u{21A9}\u{1F004}\u{1F0CF}]/gu;
    return text.replace(emojiRegex, "");
  }

  cleanText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  generateUniqueId() {
    return "msg-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
  }

  async sendMessage() {
    if (!this.currentConversationId) this.currentConversationId = this.generateUniqueId();
    let inputText = this.inputChat.textContent;
    if (!inputText.trim()) return;
    inputText = this.removeEmojis(inputText);

    const message = {
      id: this.generateUniqueId(),
      timestamp: new Date().toISOString(),
      sender: "user",
      content: inputText
    };

    this.saveMessage(this.currentConversationId, message);
    this.renderMessages(this.currentConversationId);

    const contextString = this.getLastTwoMessages(this.currentConversationId);
    const fullText = `${contextString}\nNova mensagem do usuario: ${inputText}`;
    const result = await this.model.generateContent(inputText);

    const aiMessage = {
      id: this.generateUniqueId(),
      timestamp: new Date().toISOString(),
      sender: "ai",
      content: this.removeEmojis(result.response.text())
    };

    this.saveMessage(this.currentConversationId, aiMessage);
    this.renderMessages(this.currentConversationId);
  }

  getLastTwoMessages(conversationId) {
    const chatHistory = this.getChatHistory(conversationId);
    const lastTwoMessages = chatHistory.slice(-2);
    let contextString = "";
    if (lastTwoMessages.length >= 2) {
      contextString =
        `${lastTwoMessages[0].sender === "user" ? "usuario" : "gemini"}: ${this.cleanText(lastTwoMessages[0].content)}\n` +
        `${lastTwoMessages[1].sender === "user" ? "usuario" : "gemini"}: ${this.cleanText(lastTwoMessages[1].content)}`;
    } else if (lastTwoMessages.length === 1) {
      contextString = `${lastTwoMessages[0].sender === "user" ? "usuario" : "gemini"}: ${this.cleanText(lastTwoMessages[0].content)}`;
    }
    return contextString;
  }

  saveMessage(conversationId, message) {
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    if (!chatGemini[conversationId]) chatGemini[conversationId] = [];
    chatGemini[conversationId].push(message);
    localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
  }

  getChatHistory(conversationId) {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    return chatGemini[conversationId] || [];
  }

  renderMessages(conversationId) {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    this.messageList.innerHTML = "";
    if (chatGemini[conversationId]) {
      chatGemini[conversationId].forEach((msg) => {
        const messageElement = document.createElement("li");
        messageElement.classList.add(msg.sender);
        const messageContent = document.createElement("span");
        messageContent.innerHTML = msg.sender === "ai" ? marked.parse(msg.content) : msg.content;
        messageElement.appendChild(messageContent);
        this.messageList.appendChild(messageElement);
      });
    }
    this.scrollToBottom();
    this.inputChat.focus();
  }

  renderConversationsList() {
    const chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    const conversationsContainer = document.getElementById("conversationsList");
    const conversationIds = Object.keys(chatGemini);

    conversationsContainer.innerHTML = '';
    conversationIds.forEach((conversationId) => {
      const option = document.createElement("option");
      option.value = conversationId;
      option.textContent = `Conversation ID: ${conversationId}`;
      conversationsContainer.appendChild(option);
    });

    if (conversationIds.length > 0) {
      const lastOption = conversationsContainer.querySelector("option:last-child");
      lastOption.selected = true;
      this.selectConversation(lastOption.value);
    }
    this.inputChat.focus();
  }

  selectConversation(conversationId) {
    this.currentConversationId = conversationId;
    this.renderMessages(conversationId);
    this.inputChat.focus();
  }

  deleteConversation(conversationId) {
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    if (chatGemini[conversationId]) {
      delete chatGemini[conversationId];
      localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
    }
    this.messageList.innerHTML = "";
    this.renderConversationsList();
  }

  scrollToBottom() {
    const lastMessage = this.chatContainer.lastElementChild;
    lastMessage.scrollIntoView({ behavior: "smooth", block: "end" });
    setTimeout(() => {
      this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }, 500);
    this.inputChat.focus();
  }

  handleScroll() {
    const isAtBottom = this.chatContainer.scrollHeight - this.chatContainer.scrollTop <= this.chatContainer.clientHeight + 5;
    this.backDownButton.style.display = isAtBottom ? "none" : "grid";
  }

  createNewChat() {
    const newConversationId = this.generateUniqueId();
    this.currentConversationId = newConversationId;
    this.inputChat.textContent = "";
    this.messageList.innerHTML = "";
    let chatGemini = JSON.parse(localStorage.getItem("chatGemini")) || {};
    chatGemini[newConversationId] = [];
    localStorage.setItem("chatGemini", JSON.stringify(chatGemini));
    this.renderConversationsList();
    this.inputChat.focus();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ChatApp("");
});
