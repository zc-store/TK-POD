import express from 'express';
import { initCron, getCronService } from '../services/cronService.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  const service = getCronService();
  
  if (!service) {
    return res.status(400).json({
      success: false,
      error: '定时任务服务未初始化',
    });
  }

  const progress = service.getProgress();
  
  res.json({
    success: true,
    data: {
      isRunning: service.isExecuting,
      progress,
    },
  });
});

router.post('/execute', async (req, res) => {
  const service = getCronService();
  
  if (!service) {
    return res.status(400).json({
      success: false,
      error: '定时任务服务未初始化',
    });
  }

  if (service.isExecuting) {
    return res.status(400).json({
      success: false,
      error: '任务正在执行中，请等待完成',
    });
  }

  service.executeDailyTask();
  
  res.json({
    success: true,
    message: '定时任务已启动',
  });
});

router.post('/init', async (req, res) => {
  try {
    await initCron();
    res.json({
      success: true,
      message: '定时任务初始化成功',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message,
    });
  }
});

export default router;