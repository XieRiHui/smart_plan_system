<template>
  <div class="app">
    <main class="main">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
</script>

<style>
:root {
  /* 多巴胺渐变色系 */
  --primary-gradient: linear-gradient(135deg, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #FFEAA7, #DDA0DD);
  --secondary-gradient: linear-gradient(135deg, #FF9A8B, #FF6A88, #FF99AC);
  --accent-gradient: linear-gradient(135deg, #A8E6CF, #DCEDC2, #FFD3B5, #FFAAA6, #FF8B94);
  --text-gradient: linear-gradient(135deg, #3A1C71, #D76D77, #FFAF7B);
  --background-gradient: linear-gradient(135deg, #f5f7fa, #c3cfe2);
  --card-gradient: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
  --button-gradient: linear-gradient(135deg, #FF6B6B, #4ECDC4);
  --button-hover-gradient: linear-gradient(135deg, #FF8E8E, #45B7D1);
  --border-radius: 12px;
  --box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  --transition: all 0.3s ease;
  --font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-family);
  line-height: 1.6;
  color: #333;
  background: var(--background-gradient);
  min-height: 100vh;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow-x: hidden;
}

.main {
  flex: 1;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
  position: relative;
  z-index: 1;
  animation: fadeIn 1s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

button {
  background: var(--button-gradient);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: var(--transition);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
  position: relative;
  overflow: hidden;
}

button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s;
}

button:hover::before {
  left: 100%;
}

button:hover {
  background: var(--button-hover-gradient);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
}

button:active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

button.delete {
  background: linear-gradient(135deg, #FF6B6B, #FF8E8E);
}

button.delete:hover {
  background: linear-gradient(135deg, #FF5252, #FF7979);
  box-shadow: 0 6px 16px rgba(255, 107, 107, 0.4);
}

input, select, textarea {
  padding: 0.75rem 1rem;
  border: 2px solid rgba(0, 0, 0, 0.1);
  border-radius: var(--border-radius);
  font-size: 1rem;
  width: 100%;
  margin-bottom: 1.5rem;
  transition: var(--transition);
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #4ECDC4;
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  transform: translateY(-2px);
}

.card {
  background: var(--card-gradient);
  border-radius: var(--border-radius);
  box-shadow: var(--box-shadow);
  padding: 2rem;
  margin-bottom: 2rem;
  backdrop-filter: blur(10px);
  transition: var(--transition);
  position: relative;
  overflow: hidden;
}

.card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: var(--primary-gradient);
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}

.error {
  color: #FF6B6B;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-5px);
  }
  75% {
    transform: translateX(5px);
  }
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 3rem;
  height: 300px;
}

.loading::after {
  content: '';
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #4ECDC4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  box-shadow: 0 0 20px rgba(78, 205, 196, 0.5);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .header h1 {
    font-size: 2rem;
  }
  
  .main {
    padding: 1rem;
  }
  
  .card {
    padding: 1.25rem;
  }
  
  button {
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }
  
  input, select, textarea {
    padding: 0.6rem 0.9rem;
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .header h1 {
    font-size: 1.5rem;
  }
  
  .main {
    padding: 0.75rem;
  }
  
  .card {
    padding: 1rem;
  }
}
</style>
