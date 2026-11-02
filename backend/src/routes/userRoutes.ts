import { Router } from 'express'
import {
  createUserController,
  listOfficersController,
  listUsersController,
  updateUserController,
} from '../controllers/userController.js'
import { authenticate } from '../middleware/authenticate.js'
import { authorize } from '../middleware/authorize.js'
import { validate } from '../middleware/validate.js'
import { userIdParamsSchema, createUserSchema, updateUserSchema } from '../validators/users.js'

const userRoutes = Router()
userRoutes.use(authenticate)
userRoutes.get('/officers', authorize('ADMIN', 'REVENUE_OFFICER'), listOfficersController)
userRoutes.get('/', authorize('ADMIN'), listUsersController)
userRoutes.post('/', authorize('ADMIN'), validate(createUserSchema, 'body'), createUserController)
userRoutes.patch('/:userId', authorize('ADMIN'), validate(userIdParamsSchema, 'params'), validate(updateUserSchema, 'body'), updateUserController)

export default userRoutes
