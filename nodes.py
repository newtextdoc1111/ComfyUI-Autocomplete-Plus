#  Package Modules
import os
from typing import Union, BinaryIO, Dict, List, Tuple, Optional
import time

#  ComfyUI Modules
import folder_paths
from comfy.utils import ProgressBar

#  Your Modules
from .modules.calculator import CalculatorModel


#  Basic practice to get paths from ComfyUI
custom_nodes_script_dir = os.path.dirname(os.path.abspath(__file__))
custom_nodes_model_dir = os.path.join(folder_paths.models_dir, "my-custom-nodes")
custom_nodes_output_dir = os.path.join(folder_paths.get_output_directory(), "my-custom-nodes")


#  These are example nodes that only contains basic functionalities with some comments.
#  If you need detailed explanation, please refer to : https://docs.comfy.org/essentials/custom_node_walkthrough
#  First Node:
class MyModelLoader:
    #  Define the input parameters of the node here.
    @classmethod
    def INPUT_TYPES(s):
        my_models = ["Model A", "Model B", "Model C"]

        return {
            #  If the key is "required", the value must be filled.
            "required": {
                #  `my_models` is the list, so it will be shown as a dropdown menu in the node. ( So that user can select one of them. )
                #  You must provide the value in the tuple format. e.g. ("value",) or (3,) or ([1, 2],) etc.
                "model": (my_models,),
                "device": (['cuda', 'cpu', 'auto'],),
            },
            #  If the key is "optional", the value is optional.
            "optional": {
                "compute_type": (['float32', 'float16'],),
            }
        }

    #  Define these constants inside the node.
    #  `RETURN_TYPES` is important, as it limits the parameter types that can be passed to the next node, in `INPUT_TYPES()` above.
    RETURN_TYPES = ("MY_MODEL",)
    RETURN_NAMES = ("my_model",)
    #  `FUNCTION` is the function name that will be called in the node.
    FUNCTION = "load_model"
    #  `CATEGORY` is the category name that will be used when user searches the node.
    CATEGORY = "CustomNodesTemplate"

    #  In the function, use same parameter names as you specified in `INPUT_TYPES()`
    def load_model(self,
                   model: str,
                   device: str,
                   compute_type: Optional[str] = None,
                   ) -> Tuple[CalculatorModel]:
        calculator_model = CalculatorModel()
        calculator_model.load_model(model, device, compute_type)

        #  You can use `comfy.utils.ProgressBar` to show the progress of the process.
        #  First, initialize the total amount of the process.
        total_steps = 5
        comfy_pbar = ProgressBar(total_steps)
        #  Then, update the progress.
        for i in range(1, total_steps):
            time.sleep(1)
            comfy_pbar.update(i)  #  Alternatively, you can use `comfy_pbar.update_absolute(value)` to update the progress with absolute value.

        #  Return the model as a tuple.
        return (calculator_model, )


#  Second Node
class CalculatePlus:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": ("MY_MODEL", ),
            },
            #  Specify the parameters with type and default value.
            "optional": {
                "a": ("INT", {"default": 5}),
                "b": ("INT", {"default": 10}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("plus_value",)
    FUNCTION = "plus"
    CATEGORY = "CustomNodesTemplate"

    def plus(self,
             model: CalculatorModel,
             a: Optional[int],
             b: Optional[int],
             ) -> Tuple[int]:
        result = model.plus(a, b)
        return (result, )



#  Third Node
class CalculateMinus:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": ("MY_MODEL", ),
                "a": ("INT", ),
            },
            "optional": {
                "b": ("INT", {"default": 10}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("minus_value",)
    FUNCTION = "minus"
    CATEGORY = "CustomNodesTemplate"

    def minus(self,
             model: CalculatorModel,
             a: Optional[int],
             b: Optional[int],
             ) -> Tuple[int]:
        result = model.minus(a, b)
        return (result, )



#  Output Node
class ExampleOutputNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "value": ("INT", ),
            },
        }

    #  If the node is output node, set this to True.
    OUTPUT_NODE = True
    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("int",)
    FUNCTION = "result"
    CATEGORY = "CustomNodesTemplate"

    def result(self,
               value: int,) -> Tuple[int]:
        return (value, )
