# Coup Game Project Overview

## 项目简介 / Project Description

这是一个基于 React + TypeScript + Vite 的 **Coup（政变）卡牌游戏** Web 原型。项目目前是一个可运行的 Web 应用，计划转换为 Expo React Native 移动应用。

This is a **Coup card game** Web prototype built with React + TypeScript + Vite. The project is currently a working Web application, with plans to convert it to an Expo React Native mobile app.

---

## 当前状态 / Current Status

### ✅ 已完成 / Completed
- **Web 版本已修复并运行** - 应用可以正常启动并显示界面
- **游戏引擎** - 完整的游戏逻辑实现（纯 TypeScript，无 DOM 依赖）
- **UI 组件** - 按钮、玩家卡片、游戏日志等组件
- **国际化支持** - 英文 (en) 和中文 (zh) 双语支持
- **游戏流程** - 大厅、等待室、游戏界面完整实现

### 🚧 进行中 / In Progress
- **Expo 转换** - 正在将 Web 应用转换为 Expo React Native 应用
- **Socket.io 集成** - 准备添加 WebSocket 客户端连接

---

## 技术栈 / Tech Stack

### Web 版本 (当前)
- **框架**: React 19.2.4
- **构建工具**: Vite 6.2.0
- **语言**: TypeScript 5.8.2
- **UI**: Tailwind CSS (CDN)
- **图标**: Lucide React
- **状态管理**: React Hooks (useState, useEffect)

### 计划中的移动版本
- **框架**: Expo ~52.0.0 + React Native 0.76.5
- **路由**: Expo Router ~4.0.0
- **样式**: NativeWind 4.0.1 (Tailwind for RN)
- **网络**: Socket.io Client 4.7.5
- **国际化**: 自定义 LanguageContext

---

## 项目结构 / Project Structure

```
Coup/
├── App.tsx                 # 主应用组件（包含游戏状态和 UI）
├── index.tsx              # React 入口文件
├── index.html             # HTML 模板
├── types.ts               # TypeScript 类型定义
├── constants.ts           # 游戏常量和国际化文本
├── vite.config.ts         # Vite 配置
├── tsconfig.json          # TypeScript 配置
├── package.json           # 依赖管理
│
├── components/            # React 组件
│   ├── Button.tsx        # 按钮组件
│   ├── PlayerCard.tsx    # 玩家卡片组件
│   └── GameLog.tsx       # 游戏日志组件
│
├── services/              # 业务逻辑
│   ├── gameEngine.ts     # 游戏引擎（纯 TypeScript）
│   └── socketClient.ts   # Socket.io 客户端（Expo 版本）
│
├── contexts/              # React Context（Expo 版本）
│   └── LanguageContext.tsx  # 语言切换 Context
│
└── app/                   # Expo Router 页面（Expo 版本）
    ├── _layout.tsx        # 根布局
    ├── index.tsx          # 大厅页面 (/)
    ├── room/[id].tsx      # 等待室页面 (/room/:id)
    └── game/[id].tsx      # 游戏页面 (/game/:id)
```

---

## 核心功能 / Core Features

### 1. 游戏引擎 (gameEngine.ts)
- **纯 TypeScript 实现** - 无 DOM/React Native 依赖
- **游戏状态管理** - GameState 类型定义
- **游戏阶段** - LOBBY, ACTION_SELECTION, CHALLENGE_WINDOW, BLOCK_RESPONSE, LOSE_CARD, GAME_OVER
- **核心函数**:
  - `initializeGame()` - 初始化游戏
  - `applyAction()` - 处理游戏动作（收入、外援、税收、政变、质疑、阻挡等）

### 2. 游戏角色 / Roles
- **Duke (公爵)** - 可以收税、阻挡外援
- **Assassin (刺客)** - 可以暗杀
- **Captain (队长)** - 可以偷取
- **Ambassador (大使)** - 可以交换手牌
- **Contessa (伯爵夫人)** - 可以阻挡暗杀

### 3. 游戏动作 / Actions
- **Income** - 收入 (+1 金币)
- **Foreign Aid** - 外援 (+2 金币，可被阻挡)
- **Tax** - 税收 (+3 金币，需要 Duke，可被质疑)
- **Coup** - 政变 (-7 金币，强制弃牌)
- **Challenge** - 质疑
- **Block** - 阻挡
- **Pass** - 过

### 4. 国际化 / Internationalization
- **支持语言**: 英文 (en) 和中文 (zh)
- **翻译内容**: 所有 UI 文本、角色名称、动作名称
- **切换方式**: 语言切换按钮

### 5. 房间系统 / Room System
- **创建房间** - 生成房间 ID
- **加入房间** - 通过房间 ID 加入
- **玩家列表** - 显示所有玩家
- **房主系统** - 房主可以开始游戏
- **最小玩家数** - 至少需要 2 名玩家才能开始

---

## 游戏流程 / Game Flow

### 阶段 1: 大厅 (Lobby)
1. 玩家输入昵称
2. 加入或创建房间
3. 显示房间代码和玩家列表
4. 房主可以开始游戏（需要至少 2 名玩家）

### 阶段 2: 游戏进行中 (In Game)
1. **行动选择** - 当前玩家选择动作
2. **质疑窗口** - 其他玩家可以质疑或阻挡
3. **阻挡响应** - 如果被阻挡，原玩家可以质疑阻挡者
4. **弃牌阶段** - 失败的玩家需要弃掉一张手牌
5. **回合结束** - 轮到下一个玩家
6. **游戏结束** - 只剩一名玩家存活时结束

---

## 最近修复的问题 / Recent Fixes

### 1. 空白页面问题
- ✅ 修复了 `constants.ts` 中的 Language 类型导入
- ✅ 移除了 `index.html` 中与 Vite 冲突的 importmap
- ✅ 验证了 `index.html` 包含正确的 `<div id="root"></div>`
- ✅ 验证了 `index.tsx` 正确挂载 React 应用

### 2. 配置问题
- ✅ Vite 配置正确（`@` 别名指向项目根目录）
- ✅ TypeScript 配置正确
- ✅ 无运行时 process.env 访问问题

---

## 开发命令 / Development Commands

```bash
# 安装依赖
npm install

# 启动开发服务器（Web）
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

---

## 计划功能 / Planned Features

### Expo 移动版本
- [ ] Expo Router 页面路由
- [ ] NativeWind 样式系统
- [ ] Socket.io 客户端集成
- [ ] 语言切换 Context
- [ ] 房主逻辑完善（房主标识、开始按钮权限、房主断线重分配）
- [ ] 重连机制

### 服务器集成
- [ ] Node.js 权威服务器
- [ ] WebSocket/Socket.io 服务器
- [ ] 房间管理
- [ ] 玩家管理
- [ ] 游戏状态同步

---

## 关键文件说明 / Key Files

### `App.tsx`
- 主应用组件
- 管理游戏状态（useState）
- 处理用户交互
- 渲染大厅和游戏界面

### `services/gameEngine.ts`
- 纯 TypeScript 游戏逻辑
- 无框架依赖
- 可在 Web 和移动端复用

### `types.ts`
- 所有 TypeScript 类型定义
- GameState, Player, Phase, Role, ActionType 等

### `constants.ts`
- 游戏常量（初始金币、最大/最小玩家数）
- 角色牌堆配置
- 国际化文本（I18N）

---

## 注意事项 / Notes

1. **游戏引擎是纯 TypeScript** - 可以在 Web 和移动端共享
2. **当前是模拟模式** - 使用 setTimeout 模拟网络延迟，实际需要 Socket.io
3. **国际化已实现** - 但 Expo 版本需要 LanguageContext
4. **样式系统** - Web 使用 Tailwind CDN，移动端计划使用 NativeWind

---

## 下一步 / Next Steps

1. 完成 Expo 项目结构设置
2. 实现 Socket.io 客户端连接
3. 转换所有组件到 React Native
4. 实现房主逻辑和权限控制
5. 添加重连机制
6. 测试游戏流程

---

## 联系信息 / Contact

如有问题或需要更多信息，请查看代码注释或联系开发团队。

For questions or more information, please check code comments or contact the development team.
